import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  extractDocument,
  isExtractableMimeType,
} from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { createEvidenceRepository } from "@/lib/repositories/create-evidence-repository";
import { buildSingleConnectorCatalog } from "@/lib/connectors/ingest";
import { analyzeAndPersistIncremental } from "@/lib/application/incremental-analysis";
import {
  companyBriefSeed,
  companyDNA as dnaProfile,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import {
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
} from "@/lib/supabase/repository";
import {
  COMPANY_DOCUMENTS_BUCKET,
  MANUAL_UPLOAD_CONNECTOR_ID,
} from "./constants";
import {
  claimDocumentJob,
  markDocumentFailed,
  markDocumentProcessed,
  updateDocumentStage,
  type DocumentJobRow,
} from "./claim";
import { logUploadProcessingEvent, logUploadProcessingException } from "./logging";
import { wasProcessingCancelled } from "./cancel";
import {
  evidenceIdForManualUpload,
  manualUploadExternalKey,
} from "./removal-policy";

export type ProcessDocumentResult = {
  documentId: string;
  companyId: string;
  status: "processed" | "failed" | "skipped";
  evidenceId?: string;
  errorMessage?: string;
  reason?: string;
};

/**
 * Claim → extract → evidence → canonical Insight Engine → PROCESSED|FAILED.
 * Safe under concurrent workers via atomic claim.
 */
export async function processManualUploadDocument(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<ProcessDocumentResult> {
  const claimed = await claimDocumentJob({
    client: input.client,
    companyId: input.companyId,
    documentId: input.documentId,
  });

  if (!claimed) {
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId: input.documentId,
      companyId: input.companyId,
      stage: "claim",
      outcome: "skipped",
      status: "skipped",
    });
    return {
      documentId: input.documentId,
      companyId: input.companyId,
      status: "skipped",
      reason: "not_claimable",
    };
  }

  return continueClaimedManualUpload({
    client: input.client,
    companyId: input.companyId,
    claimed,
  });
}

/**
 * Run extraction + Insight Engine for an already-claimed document.
 * Used after an early 202 from the process route (waitUntil continuation).
 */
export async function continueClaimedManualUpload(input: {
  client: AppSupabaseClient;
  companyId: string;
  claimed: DocumentJobRow;
}): Promise<ProcessDocumentResult> {
  const { claimed, companyId } = input;
  const documentId = claimed.id;

  if (claimed.connector_id !== MANUAL_UPLOAD_CONNECTOR_ID) {
    await markDocumentFailed({
      client: input.client,
      companyId,
      documentId,
      errorMessage: "Document is not a manual upload",
      lastStage: "claim",
    });
    logUploadProcessingEvent("manual_upload_processing_failed", {
      documentId,
      companyId,
      stage: "claim",
      outcome: "failed",
      status: "FAILED",
      errorMessage: "Document is not a manual upload",
    });
    return {
      documentId,
      companyId,
      status: "failed",
      errorMessage: "Document is not a manual upload",
    };
  }

  try {
    if (!claimed.storage_path || !claimed.mime_type) {
      throw new Error("Document is missing storage_path or mime_type");
    }

    if (!isExtractableMimeType(claimed.mime_type)) {
      throw new Error(`Unsupported mime type: ${claimed.mime_type}`);
    }

    if (
      await wasProcessingCancelled({
        client: input.client,
        companyId,
        documentId,
      })
    ) {
      return {
        documentId,
        companyId,
        status: "failed",
        errorMessage: "cancelled_by_user",
      };
    }

    logUploadProcessingEvent("manual_upload_processing_started", {
      documentId,
      companyId,
      stage: "extracting",
      outcome: "started",
      status: "PROCESSING",
    });

    const { data: blob, error: downloadError } = await input.client.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .download(claimed.storage_path);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "download failed");
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const title = claimed.filename ?? claimed.title;

    const extracted = extractDocument({
      title,
      mimeType: claimed.mime_type,
      bytes,
      sourceMetadata: {
        document_id: claimed.id,
        storage_path: claimed.storage_path,
        source: "manual-upload",
      },
    });

    if (!extracted.text.trim()) {
      throw new Error("Extraction produced empty text");
    }

    if (
      await wasProcessingCancelled({
        client: input.client,
        companyId,
        documentId,
      })
    ) {
      return {
        documentId,
        companyId,
        status: "failed",
        errorMessage: "cancelled_by_user",
      };
    }

    await updateDocumentStage({
      client: input.client,
      companyId,
      documentId,
      status: "EXTRACTED",
      lastStage: "extracted",
    });

    const now = new Date().toISOString();
    const item: RawConnectorItem = {
      externalId: claimed.external_id,
      title,
      syncedAt: now,
      rawSummary: extracted.text.slice(0, 500),
      path: claimed.path ?? title,
      modifiedAt: claimed.modified_at ?? undefined,
      mimeType: claimed.mime_type,
      contentHash: claimed.content_hash ?? undefined,
      metadata: {
        document_id: claimed.id,
        source: "manual-upload",
        ...(claimed.uri ? { uri: claimed.uri } : {}),
      },
    };

    const raw = rawDocumentFromConnectorItem(
      item,
      MANUAL_UPLOAD_CONNECTOR_ID,
      "Manual Upload",
    );
    const evidenceId = evidenceIdForManualUpload(claimed.id);
    const { evidence: built } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId,
    });
    const evidence = {
      ...built,
      id: evidenceId,
      metadata: {
        ...built.metadata,
        documentId: claimed.id,
        document_id: claimed.id,
        externalKey: manualUploadExternalKey(claimed.id),
        source: "manual-upload",
      },
    };

    const evidenceRepo = createEvidenceRepository({ client: input.client });
    await evidenceRepo.upsert(companyId, [evidence]);

    if (
      await wasProcessingCancelled({
        client: input.client,
        companyId,
        documentId,
      })
    ) {
      return {
        documentId,
        companyId,
        status: "failed",
        errorMessage: "cancelled_by_user",
      };
    }

    await updateDocumentStage({
      client: input.client,
      companyId,
      documentId,
      status: "ANALYZING",
      lastStage: "analyzing",
    });

    logUploadProcessingEvent("manual_upload_processing_started", {
      documentId,
      companyId,
      stage: "analyzing",
      outcome: "started",
      status: "ANALYZING",
    });

    const company =
      companyId === companyProfile.id
        ? companyProfile
        : { ...companyProfile, id: companyId, name: companyId };

    const { count: processedCount } = await input.client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "PROCESSED");

    const snapshot = await analyzeAndPersistIncremental({
      company,
      changedEvidenceIds: [evidenceId],
      dimensionProfiles,
      previousHealthScore,
      dna: dnaProfile,
      reports: companyReports,
      timelineSeed: companyTimelineSeed,
      briefSeed: companyBriefSeed,
      evidenceCatalog: buildSingleConnectorCatalog({
        connectorId: MANUAL_UPLOAD_CONNECTOR_ID,
        name: "Manual Upload",
        system: "Manual Upload",
        documentsAnalyzed: (processedCount ?? 0) + 1,
        lastSynced: now,
        lastFullScan: now,
      }),
      client: input.client,
    });

    await replaceCompanyRecommendations(
      input.client,
      companyId,
      snapshot.recommendations,
    );
    await replaceCompanyTimeline(input.client, companyId, snapshot.timeline);

    await input.client.from("analysis_snapshots").insert({
      company_id: companyId,
      status: "completed",
      as_of: now,
      payload: {
        source: "manual-upload",
        documentId,
        evidenceId,
        healthScore: snapshot.healthScore.score,
        affected: snapshot.affected,
      },
    });

    if (
      await wasProcessingCancelled({
        client: input.client,
        companyId,
        documentId,
      })
    ) {
      return {
        documentId,
        companyId,
        status: "failed",
        errorMessage: "cancelled_by_user",
      };
    }

    await markDocumentProcessed({
      client: input.client,
      companyId,
      documentId,
      rawSummary: extracted.text,
    });

    logUploadProcessingEvent("manual_upload_processing_completed", {
      documentId,
      companyId,
      stage: "processed",
      outcome: "processed",
      status: "PROCESSED",
    });

    return {
      documentId,
      companyId,
      status: "processed",
      evidenceId,
    };
  } catch (err) {
    logUploadProcessingException("manual_upload_processing_exception", {
      documentId,
      companyId,
      filename: claimed.filename ?? claimed.title,
      mimeType: claimed.mime_type,
      stage: "continueClaimedManualUpload",
      err,
    });
    const message = err instanceof Error ? err.message : String(err);
    await markDocumentFailed({
      client: input.client,
      companyId,
      documentId,
      errorMessage: message,
      lastStage: "failed",
    });
    logUploadProcessingEvent("manual_upload_processing_failed", {
      documentId,
      companyId,
      stage: "failed",
      outcome: "failed",
      status: "FAILED",
      errorMessage: message.slice(0, 500),
      errorStack:
        err instanceof Error
          ? (err.stack ?? message).slice(0, 4000)
          : String(err),
    });
    return {
      documentId,
      companyId,
      status: "failed",
      errorMessage: message,
    };
  }
}

/**
 * Drain QUEUED + stale PROCESSING jobs for a company (cron / batch).
 */
export async function processQueuedManualUploads(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
}): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  evidenceIds: string[];
  results: ProcessDocumentResult[];
}> {
  const limit = input.limit ?? 20;
  const nowIso = new Date().toISOString();

  const { data: queued, error: queuedError } = await input.client
    .from("documents")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queuedError) {
    throw new Error(`processQueuedManualUploads.queued: ${queuedError.message}`);
  }

  const { data: stale, error: staleError } = await input.client
    .from("documents")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "PROCESSING")
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (staleError) {
    throw new Error(`processQueuedManualUploads.stale: ${staleError.message}`);
  }

  const ids = [
    ...new Set([
      ...(queued ?? []).map((r) => r.id),
      ...(stale ?? []).map((r) => r.id),
    ]),
  ].slice(0, limit);

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const evidenceIds: string[] = [];
  const results: ProcessDocumentResult[] = [];

  for (const documentId of ids) {
    const result = await processManualUploadDocument({
      client: input.client,
      companyId: input.companyId,
      documentId,
    });
    results.push(result);
    if (result.status === "processed") {
      processed += 1;
      if (result.evidenceId) evidenceIds.push(result.evidenceId);
    } else if (result.status === "failed") {
      failed += 1;
    } else {
      skipped += 1;
    }
  }

  return { processed, failed, skipped, evidenceIds, results };
}
