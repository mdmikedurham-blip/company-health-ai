import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  extractDocument,
  isExtractableMimeType,
} from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { createEvidenceRepository } from "@/lib/repositories/create-evidence-repository";
import {
  COMPANY_DOCUMENTS_BUCKET,
  DOWNLOAD_TIMEOUT_MS,
  EXTRACTION_TIMEOUT_MS,
  MANUAL_UPLOAD_CONNECTOR_ID,
} from "./constants";
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
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { isTimeoutError, TimeoutError, withTimeout } from "./timeout";

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

    const timedOut = isTimeoutError(err);
    const lastStage = timedOut ? "extraction_timeout" : "failed";
    await markDocumentFailed({
      client: input.client,
      companyId,
      documentId,
      errorMessage: message,
      lastStage,
    });
    // Timeouts are already logged in extractAndPersistEvidence with stage detail.
    if (!timedOut) {
      logUploadProcessingEvent("manual_upload_processing_failed", {
        documentId,
        companyId,
        stage: lastStage,
        outcome: "failed",
        status: "FAILED",
        errorMessage: message.slice(0, 500),
        reason: "extraction_error",
        leaseCleared: true,
        errorStack:
          err instanceof Error
            ? (err.stack ?? message).slice(0, 4000)
            : String(err),
      });
    } else {
      logUploadProcessingEvent("manual_upload_extraction_timeout", {
        documentId,
        companyId,
        stage: "lease_cleared",
        outcome: "failed",
        status: "FAILED",
        errorMessage: message.slice(0, 500),
        reason: "extraction_timeout",
        leaseCleared: true,
      });
    }
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
  const extractionStartedAt = Date.now();

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
    extractionTimeoutMs: EXTRACTION_TIMEOUT_MS,
    downloadTimeoutMs: DOWNLOAD_TIMEOUT_MS,
    leaseExpiresAt: claimed.lease_expires_at ?? undefined,
  });

  try {
    const remainingBudget = () =>
      Math.max(1_000, EXTRACTION_TIMEOUT_MS - (Date.now() - extractionStartedAt));

    const { data: blob, error: downloadError } = await withTimeout(
      client.storage.from(COMPANY_DOCUMENTS_BUCKET).download(claimed.storage_path),
      Math.min(DOWNLOAD_TIMEOUT_MS, remainingBudget()),
      "storage_download",
    );

    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "download failed");
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (Date.now() - extractionStartedAt > EXTRACTION_TIMEOUT_MS) {
      throw new TimeoutError("storage_download", EXTRACTION_TIMEOUT_MS);
    }

    const title = claimed.filename ?? claimed.title;

    // Sync parsers cannot be aborted mid-CPU; wall-clock checked immediately after.
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

    if (Date.now() - extractionStartedAt > EXTRACTION_TIMEOUT_MS) {
      throw new TimeoutError("extract_document", EXTRACTION_TIMEOUT_MS);
    }

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
    await withTimeout(
      evidenceRepo.upsert(companyId, [evidence]),
      remainingBudget(),
      "evidence_upsert",
    );

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
        raw_summary: (() => {
          const slice = extracted.text.slice(0, 4000);
          if (
            /%PDF-|endobj|\b\d+\s+\d+\s+obj\b/.test(slice) ||
            /[\x00-\x08\x0E-\x1F]/.test(slice)
          ) {
            return "PDF text extraction suppressed object-stream / binary content.";
          }
          return slice;
        })(),
        lease_expires_at: null,
        locked_at: null,
      },
    });

    logUploadProcessingEvent("manual_upload_processing_started", {
      documentId,
      companyId,
      stage: "extracted",
      outcome: "completed",
      status: "EXTRACTED",
      elapsedMs: Date.now() - extractionStartedAt,
    });

    return {
      documentId,
      companyId,
      status: "extracted",
      evidenceId,
    };
  } catch (error) {
    const timedOut = isTimeoutError(error);
    if (timedOut) {
      logUploadProcessingEvent("manual_upload_extraction_timeout", {
        documentId,
        companyId,
        stage:
          error instanceof TimeoutError ? error.stage : "extraction_timeout",
        outcome: "failed",
        status: "FAILED",
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(
          0,
          500,
        ),
        elapsedMs: Date.now() - extractionStartedAt,
        extractionTimeoutMs: EXTRACTION_TIMEOUT_MS,
        leaseExpiresAt: claimed.lease_expires_at ?? undefined,
        reason: "extraction_timeout",
      });
    }
    throw error;
  }
}

/**
 * Drain QUEUED + stale PROCESSING jobs: concurrent extract, one company analysis.
 * Runs lease recovery first so abandoned EXTRACTING (PROCESSING) rows are requeued.
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
  recovered: { requeuedProcessing: number; staleExtracted: number };
}> {
  const limit = input.limit ?? 20;
  const concurrency = input.extractionConcurrency ?? EXTRACTION_CONCURRENCY;

  const recovery = await recoverAbandonedManualUploadJobs({
    client: input.client,
    companyId: input.companyId,
    limit,
  });

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

  // Prefer recovered + any QUEUED (recovery already requeued abandoned PROCESSING).
  const claimIds = [
    ...new Set([
      ...recovery.requeuedProcessingIds,
      ...(queued ?? []).map((r) => r.id),
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

  // Stale/parked EXTRACTED leftovers need a company analysis pass.
  const needsAnalysis =
    (extractedWaiting?.length ?? 0) > 0 ||
    recovery.staleExtractedIds.length > 0;
  if (needsAnalysis && claimIds.length === 0) {
    const triggerId =
      recovery.staleExtractedIds[0] ?? extractedWaiting![0]!.id;
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
  } else if (recovery.staleExtractedIds.length > 0 && claimIds.length > 0) {
    // Extractions above already call analysis; if they deferred, kick once more.
    const pass = await runCompanyAnalysisPass({
      client: input.client,
      companyId: input.companyId,
      triggerDocumentId: recovery.staleExtractedIds[0]!,
      debounceMs: 0,
    });
    for (const id of pass.analyzedDocumentIds) {
      if (!results.some((r) => r.documentId === id && r.status === "processed")) {
        results.push({
          documentId: id,
          companyId: input.companyId,
          status: "processed",
          evidenceId: id,
        });
      }
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

  return {
    processed,
    failed,
    skipped,
    extracted,
    evidenceIds,
    results,
    recovered: {
      requeuedProcessing: recovery.requeuedProcessingIds.length,
      staleExtracted: recovery.staleExtractedIds.length,
    },
  };
}
