import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  extractDocument,
  isExtractableMimeType,
} from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { createEvidenceRepository } from "@/lib/repositories/create-evidence-repository";
import { COMPANY_DOCUMENTS_BUCKET, MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import {
  claimDocumentJob,
  markDocumentFailed,
  updateDocumentStage,
  type DocumentJobRow,
} from "./claim";
import {
  mapWithConcurrency,
  runCompanyAnalysisPass,
} from "./company-analysis";
import { logUploadProcessingEvent, logUploadProcessingException } from "./logging";
import { wasProcessingCancelled } from "./cancel";
import {
  evidenceIdForManualUpload,
  manualUploadExternalKey,
} from "./removal-policy";

/** Max concurrent extractors inside a single drain/batch worker. */
export const EXTRACTION_CONCURRENCY = 4;

export type ProcessDocumentResult = {
  documentId: string;
  companyId: string;
  status: "processed" | "failed" | "skipped" | "extracted";
  evidenceId?: string;
  errorMessage?: string;
  reason?: string;
};

/**
 * Claim → extract → evidence → EXTRACTED → coalesced company analysis → PROCESSED|FAILED.
 * Safe under concurrent workers via per-doc claim + company analysis advisory lock.
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
 * Extract + evidence for an already-claimed document, then join company analysis.
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
    const extracted = await extractAndPersistEvidence({
      client: input.client,
      companyId,
      claimed,
    });

    if (extracted.status === "failed") {
      return extracted;
    }

    // Leave EXTRACTED; company analysis is serialized/coalesced.
    const analysis = await runCompanyAnalysisPass({
      client: input.client,
      companyId,
      triggerDocumentId: documentId,
      debounceMs:
        process.env.VITEST === "true" || process.env.NODE_ENV === "test"
          ? 0
          : undefined,
    });

    if (analysis.processed) {
      return {
        documentId,
        companyId,
        status: "processed",
        evidenceId: extracted.evidenceId,
      };
    }

    if (analysis.deferred) {
      logUploadProcessingEvent("manual_upload_processing_kickoff", {
        documentId,
        companyId,
        stage: "company_analysis",
        outcome: "deferred",
        status: "EXTRACTED",
      });
      return {
        documentId,
        companyId,
        status: "extracted",
        evidenceId: extracted.evidenceId,
        reason: "awaiting_company_analysis",
      };
    }

    // Analysis ran but trigger not processed (should be rare) — keep EXTRACTED.
    return {
      documentId,
      companyId,
      status: "extracted",
      evidenceId: extracted.evidenceId,
      reason: "awaiting_company_analysis",
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

    // Never fail a doc solely because company analysis is busy — leave EXTRACTED.
    if (/company analysis|advisory lock|awaiting_company/i.test(message)) {
      await updateDocumentStage({
        client: input.client,
        companyId,
        documentId,
        status: "EXTRACTED",
        lastStage: "extracted",
        patch: {
          lease_expires_at: null,
          locked_at: null,
        },
      });
      return {
        documentId,
        companyId,
        status: "extracted",
        reason: "awaiting_company_analysis",
        errorMessage: message,
      };
    }

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

async function extractAndPersistEvidence(input: {
  client: AppSupabaseClient;
  companyId: string;
  claimed: DocumentJobRow;
}): Promise<ProcessDocumentResult> {
  const { claimed, companyId, client } = input;
  const documentId = claimed.id;

  if (!claimed.storage_path || !claimed.mime_type) {
    throw new Error("Document is missing storage_path or mime_type");
  }

  if (!isExtractableMimeType(claimed.mime_type)) {
    throw new Error(`Unsupported mime type: ${claimed.mime_type}`);
  }

  if (
    await wasProcessingCancelled({
      client,
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

  const { data: blob, error: downloadError } = await client.storage
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
      client,
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
  if (evidenceId !== claimed.id) {
    throw new Error(
      `manual upload evidence id mismatch: evidence=${evidenceId} document=${claimed.id}`,
    );
  }
  const { evidence: built } = runEvidenceExtractionPipeline(raw, extracted, {
    evidenceId,
  });
  const evidence = {
    ...built,
    id: claimed.id,
    metadata: {
      ...built.metadata,
      documentId: claimed.id,
      document_id: claimed.id,
      externalKey: manualUploadExternalKey(claimed.id),
      source: "manual-upload",
    },
  };

  logUploadProcessingEvent("manual_upload_processing_started", {
    documentId,
    companyId,
    stage: "evidence_upsert",
    outcome: "started",
    evidenceId: evidence.id,
  });

  const evidenceRepo = createEvidenceRepository({ client });
  await evidenceRepo.upsert(companyId, [evidence]);

  if (
    await wasProcessingCancelled({
      client,
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

  // Park at EXTRACTED with lease cleared — company analysis will pick it up.
  await updateDocumentStage({
    client,
    companyId,
    documentId,
    status: "EXTRACTED",
    lastStage: "extracted",
    patch: {
      raw_summary: extracted.text.slice(0, 4000),
      lease_expires_at: null,
      locked_at: null,
    },
  });

  return {
    documentId,
    companyId,
    status: "extracted",
    evidenceId,
  };
}

/**
 * Drain QUEUED + stale PROCESSING jobs: concurrent extract, one company analysis.
 */
export async function processQueuedManualUploads(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
  extractionConcurrency?: number;
}): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  extracted: number;
  evidenceIds: string[];
  results: ProcessDocumentResult[];
}> {
  const limit = input.limit ?? 20;
  const concurrency = input.extractionConcurrency ?? EXTRACTION_CONCURRENCY;
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

  // Also include EXTRACTED docs waiting for a company analysis pass.
  const { data: extractedWaiting, error: extractedError } = await input.client
    .from("documents")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "EXTRACTED")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (extractedError) {
    throw new Error(
      `processQueuedManualUploads.extracted: ${extractedError.message}`,
    );
  }

  const claimIds = [
    ...new Set([
      ...(queued ?? []).map((r) => r.id),
      ...(stale ?? []).map((r) => r.id),
    ]),
  ].slice(0, limit);

  const results = await mapWithConcurrency(
    claimIds,
    concurrency,
    async (documentId) =>
      processManualUploadDocument({
        client: input.client,
        companyId: input.companyId,
        documentId,
      }),
  );

  // If only EXTRACTED leftovers (no new claims), trigger a company analysis pass.
  if (
    claimIds.length === 0 &&
    (extractedWaiting?.length ?? 0) > 0
  ) {
    const triggerId = extractedWaiting![0]!.id;
    const pass = await runCompanyAnalysisPass({
      client: input.client,
      companyId: input.companyId,
      triggerDocumentId: triggerId,
    });
    for (const id of pass.analyzedDocumentIds) {
      results.push({
        documentId: id,
        companyId: input.companyId,
        status: "processed",
        evidenceId: id,
      });
    }
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let extracted = 0;
  const evidenceIds: string[] = [];

  for (const result of results) {
    if (result.status === "processed") {
      processed += 1;
      if (result.evidenceId) evidenceIds.push(result.evidenceId);
    } else if (result.status === "failed") {
      failed += 1;
    } else if (result.status === "extracted") {
      extracted += 1;
      if (result.evidenceId) evidenceIds.push(result.evidenceId);
    } else {
      skipped += 1;
    }
  }

  return { processed, failed, skipped, extracted, evidenceIds, results };
}
