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
} from "./claim";

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
    return {
      documentId: input.documentId,
      companyId: input.companyId,
      status: "skipped",
      reason: "not_claimable",
    };
  }

  if (claimed.connector_id !== MANUAL_UPLOAD_CONNECTOR_ID) {
    await markDocumentFailed({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
      errorMessage: "Document is not a manual upload",
      lastStage: "claim",
    });
    return {
      documentId: input.documentId,
      companyId: input.companyId,
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

    await updateDocumentStage({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
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
    const evidenceId = `upload-${claimed.id}`;
    const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId,
    });

    const evidenceRepo = createEvidenceRepository({ client: input.client });
    await evidenceRepo.upsert(input.companyId, [evidence]);

    await updateDocumentStage({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
      status: "ANALYZING",
      lastStage: "analyzing",
    });

    const company =
      input.companyId === companyProfile.id
        ? companyProfile
        : { ...companyProfile, id: input.companyId, name: input.companyId };

    const { count: processedCount } = await input.client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", input.companyId)
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
      input.companyId,
      snapshot.recommendations,
    );
    await replaceCompanyTimeline(
      input.client,
      input.companyId,
      snapshot.timeline,
    );

    await input.client.from("analysis_snapshots").insert({
      company_id: input.companyId,
      status: "completed",
      as_of: now,
      payload: {
        source: "manual-upload",
        documentId: input.documentId,
        evidenceId,
        healthScore: snapshot.healthScore.score,
        affected: snapshot.affected,
      },
    });

    await markDocumentProcessed({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
      rawSummary: extracted.text,
    });

    return {
      documentId: input.documentId,
      companyId: input.companyId,
      status: "processed",
      evidenceId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never log document contents — message only.
    await markDocumentFailed({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
      errorMessage: message,
      lastStage: "failed",
    });
    return {
      documentId: input.documentId,
      companyId: input.companyId,
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
