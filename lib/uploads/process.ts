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
  markDocumentOcrRequired,
  markReprocessFailedPreserving,
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
import {
  advancePipelineStep,
  failPipelineStep,
  heartbeatPipelineStep,
  resumePipelineStep,
  shouldSkipPipelineStep,
  type PipelineStep,
} from "./pipeline";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { isTimeoutError, TimeoutError, withTimeout } from "./timeout";
import {
  CURRENT_ANALYSIS_VERSION,
  CURRENT_EXTRACTION_VERSION,
  MAX_REPROCESS_ATTEMPTS,
  nextReprocessAtIso,
} from "./versions";
import { autoEnqueueVersionStaleDocuments } from "./version-upgrade";
import {
  isOcrRequiredError,
  isPdfExtractionError,
} from "@/lib/connectors/extraction/pdf-errors";
import type { Evidence } from "@/lib/domain";

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
    logUploadProcessingEvent("pipeline_stage", {
      documentId,
      companyId,
      stage: "extraction:done",
      outcome: "ok",
      status: "EXTRACTED",
      evidenceId: extracted.evidenceId,
    });

    const analysisStarted = Date.now();
    const analysis = await runCompanyAnalysisPass({
      client: input.client,
      companyId,
      triggerDocumentId: documentId,
      debounceMs:
        process.env.VITEST === "true" || process.env.NODE_ENV === "test"
          ? 0
          : undefined,
    });

    logUploadProcessingEvent("pipeline_stage", {
      documentId,
      companyId,
      stage: "company_analysis:done",
      outcome: analysis.processed
        ? "processed"
        : analysis.deferred
          ? "deferred"
          : "pending",
      status: analysis.processed ? "PROCESSED" : "EXTRACTED",
      durationMs: Date.now() - analysisStarted,
      analyzedCount: analysis.analyzedDocumentIds.length,
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

    return finalizeProcessingFailure({
      client: input.client,
      companyId,
      claimed,
      err,
      message,
    });
  }
}

async function finalizeProcessingFailure(input: {
  client: AppSupabaseClient;
  companyId: string;
  claimed: DocumentJobRow;
  err: unknown;
  message: string;
}): Promise<ProcessDocumentResult> {
  const { claimed, companyId, client, err, message } = input;
  const documentId = claimed.id;
  const timedOut = isTimeoutError(err);
  const userMessage = isPdfExtractionError(err)
    ? err.userMessage
    : message;
  const evidenceRepo = createEvidenceRepository({ client });
  let existingEvidence: Evidence | null = null;
  if (typeof evidenceRepo.getById === "function") {
    existingEvidence = await evidenceRepo.getById(companyId, documentId);
  }
  const hadPriorSuccess = Boolean(
    claimed.last_successful_extraction_version ||
      claimed.last_successful_analysis_version ||
      existingEvidence,
  );
  const attempt = claimed.processing_attempts ?? 1;

  if (isOcrRequiredError(err)) {
    await markDocumentOcrRequired({
      client,
      companyId,
      documentId,
      errorMessage: userMessage,
    });
    logUploadProcessingEvent("manual_upload_processing_failed", {
      documentId,
      companyId,
      stage: "ocr_required",
      outcome: "failed",
      status: "OCR_REQUIRED",
      errorMessage: userMessage.slice(0, 500),
      reason: "ocr_required",
      leaseCleared: true,
    });
    return {
      documentId,
      companyId,
      status: "failed",
      errorMessage: userMessage,
      reason: "ocr_required",
    };
  }

  if (hadPriorSuccess) {
    const nextAt = nextReprocessAtIso(attempt);
    await markReprocessFailedPreserving({
      client,
      companyId,
      documentId,
      errorMessage: userMessage,
      attempt,
      nextReprocessAt:
        attempt >= MAX_REPROCESS_ATTEMPTS
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : nextAt,
    });
    logUploadProcessingEvent("manual_upload_processing_failed", {
      documentId,
      companyId,
      stage: "reprocess_failed",
      outcome: "failed",
      status: "PROCESSED",
      errorMessage: userMessage.slice(0, 500),
      reason: "reprocess_failed_previous_retained",
      leaseCleared: true,
    });
    return {
      documentId,
      companyId,
      status: "failed",
      errorMessage: userMessage,
      reason: "reprocess_failed_previous_retained",
    };
  }

  const failedStep: PipelineStep = timedOut
    ? "text_extraction"
    : isPdfExtractionError(err)
      ? "text_extraction"
      : "text_extraction";
  await failPipelineStep({
    client,
    companyId,
    documentId,
    step: failedStep,
    errorMessage: userMessage,
  });
  logUploadProcessingEvent("manual_upload_processing_failed", {
    documentId,
    companyId,
    stage: failedStep,
    outcome: "failed",
    status: "FAILED",
    errorMessage: userMessage.slice(0, 500),
    reason: timedOut ? "extraction_timeout" : "extraction_error",
    leaseCleared: true,
    errorStack:
      err instanceof Error
        ? (err.stack ?? message).slice(0, 4000)
        : String(err),
  });
  return {
    documentId,
    companyId,
    status: "failed",
    errorMessage: userMessage,
  };
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

  const evidenceRepo = createEvidenceRepository({ client });
  const evidenceId = evidenceIdForManualUpload(claimed.id);

  // Snapshot prior evidence so a failed reprocess can restore it.
  let priorEvidence: Evidence | null = null;
  if (typeof evidenceRepo.getById === "function") {
    priorEvidence = await evidenceRepo.getById(companyId, evidenceId);
  }
  let wroteNewEvidence = false;

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

    const lastSuccessful =
      (claimed as { last_successful_pipeline_step?: string | null })
        .last_successful_pipeline_step ??
      (typeof claimed.metadata === "object" &&
      claimed.metadata &&
      !Array.isArray(claimed.metadata) &&
      typeof (claimed.metadata as Record<string, unknown>)
        .last_successful_pipeline_step === "string"
        ? ((claimed.metadata as Record<string, unknown>)
            .last_successful_pipeline_step as string)
        : null);

    const resumeAt = resumePipelineStep({
      failedStep: (claimed as { failed_step?: string | null }).failed_step,
      lastSuccessfulStep: lastSuccessful,
    });

    // Resume past extraction when evidence already exists and prior steps succeeded.
    if (
      priorEvidence &&
      (shouldSkipPipelineStep("structured_fact_extraction", lastSuccessful) ||
        resumeAt === "finding_generation" ||
        resumeAt === "company_assessment_update" ||
        resumeAt === "complete")
    ) {
      await advancePipelineStep({
        client,
        companyId,
        documentId,
        step: "finding_generation",
        outcome: "waiting",
        detail: "resume_skip_extraction",
        status: "EXTRACTED",
        markSuccessful: true,
        patch: {
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

    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "storage",
      outcome: "started",
      status: "PROCESSING",
      detail: "download_from_storage",
      patch: {
        extraction_version: CURRENT_EXTRACTION_VERSION,
        analysis_version: CURRENT_ANALYSIS_VERSION,
        reprocess_error_message: null,
      },
    });

    const heartbeat = setInterval(() => {
      void heartbeatPipelineStep({
        client,
        companyId,
        documentId,
        step: "text_extraction",
      });
    }, 20_000);

    let extractedDoc: Awaited<ReturnType<typeof extractDocument>>;
    try {
      const { data: blob, error: downloadError } = await withTimeout(
        client.storage
          .from(COMPANY_DOCUMENTS_BUCKET)
          .download(claimed.storage_path),
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

      await advancePipelineStep({
        client,
        companyId,
        documentId,
        step: "storage",
        outcome: "succeeded",
        markSuccessful: true,
        status: "PROCESSING",
      });

      await advancePipelineStep({
        client,
        companyId,
        documentId,
        step: "text_extraction",
        outcome: "started",
        status: "PROCESSING",
      });

      const title = claimed.filename ?? claimed.title;

      // Staging: parse fully before touching persisted evidence.
      extractedDoc = await extractDocument({
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

      if (!extractedDoc.text.trim()) {
        throw new Error("Extraction produced empty text");
      }

      await advancePipelineStep({
        client,
        companyId,
        documentId,
        step: "text_extraction",
        outcome: "succeeded",
        markSuccessful: true,
        status: "PROCESSING",
      });

      // OCR step is skipped when text extraction succeeded.
      await advancePipelineStep({
        client,
        companyId,
        documentId,
        step: "ocr",
        outcome: "skipped",
        markSuccessful: true,
        status: "PROCESSING",
        detail: "text_extraction_sufficient",
      });
    } finally {
      clearInterval(heartbeat);
    }

    const extracted = extractedDoc!;
    const title = claimed.filename ?? claimed.title;
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
    if (evidenceId !== claimed.id) {
      throw new Error(
        `manual upload evidence id mismatch: evidence=${evidenceId} document=${claimed.id}`,
      );
    }
    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "classification",
      outcome: "started",
      status: "PROCESSING",
    });

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
        extractionVersion: CURRENT_EXTRACTION_VERSION,
      },
    };

    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "classification",
      outcome: "succeeded",
      markSuccessful: true,
      status: "PROCESSING",
      detail: String(evidence.sourceType ?? evidence.dimensionId ?? "classified"),
    });

    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "structured_fact_extraction",
      outcome: "started",
      status: "PROCESSING",
    });

    const facts = evidence.extractedFacts ?? {};
    const financialKeys = Array.isArray(facts.financialMetricKeys)
      ? (facts.financialMetricKeys as string[])
      : Object.keys(facts).filter(
          (k) =>
            typeof facts[k] === "number" &&
            [
              "revenue",
              "ebitda",
              "cashBalance",
              "burnRateMonthly",
              "cashRunwayMonths",
              "employeeCount",
              "top3CustomerArrShare",
              "netRevenueRetention",
              "grossMargin",
            ].includes(k),
        );

    logUploadProcessingEvent("pipeline_stage", {
      documentId,
      companyId,
      stage: "financial_facts:merged",
      outcome:
        financialKeys.length > 0
          ? "facts_present"
          : "facts_empty",
      format:
        typeof extracted.metadata.format === "string"
          ? extracted.metadata.format
          : undefined,
      extractedFactCount: financialKeys.length,
      financialMetricCount:
        typeof facts.financialMetricCount === "number"
          ? facts.financialMetricCount
          : financialKeys.length,
      financialKeys: financialKeys.join(","),
      revenue: typeof facts.revenue === "number" ? facts.revenue : undefined,
      ebitda: typeof facts.ebitda === "number" ? facts.ebitda : undefined,
      cashBalance:
        typeof facts.cashBalance === "number" ? facts.cashBalance : undefined,
      employeeCount:
        typeof facts.employeeCount === "number"
          ? facts.employeeCount
          : undefined,
    });

    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "structured_fact_extraction",
      outcome: "succeeded",
      markSuccessful: true,
      status: "PROCESSING",
      detail: `facts=${financialKeys.length}`,
    });

    logUploadProcessingEvent("manual_upload_processing_started", {
      documentId,
      companyId,
      stage: "evidence_upsert",
      outcome: "started",
      evidenceId: evidence.id,
    });

    await withTimeout(
      evidenceRepo.upsert(companyId, [evidence]),
      remainingBudget(),
      "evidence_upsert",
    );
    wroteNewEvidence = true;
    if (
      await wasProcessingCancelled({
        client,
        companyId,
        documentId,
      })
    ) {
      if (priorEvidence) {
        await evidenceRepo.upsert(companyId, [priorEvidence]);
      }
      return {
        documentId,
        companyId,
        status: "failed",
        errorMessage: "cancelled_by_user",
      };
    }

    // Park at EXTRACTED — next durable step is finding generation / assessment.
    await advancePipelineStep({
      client,
      companyId,
      documentId,
      step: "finding_generation",
      outcome: "waiting",
      detail: "awaiting_company_analysis",
      status: "EXTRACTED",
      markSuccessful: true,
      patch: {
        extraction_version: CURRENT_EXTRACTION_VERSION,
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
      stage: "finding_generation",
      outcome: "waiting",
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
    // Restore prior evidence if we already wrote a replacement that must be rolled back.
    if (wroteNewEvidence && priorEvidence) {
      try {
        await evidenceRepo.upsert(companyId, [priorEvidence]);
      } catch (restoreErr) {
        logUploadProcessingException("manual_upload_evidence_restore_failed", {
          documentId,
          companyId,
          filename: claimed.filename ?? claimed.title,
          mimeType: claimed.mime_type,
          stage: "evidence_restore",
          err: restoreErr,
        });
      }
    }

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
  recovered: {
    requeuedProcessing: number;
    staleExtracted: number;
    recoveredAnalyzing: number;
  };
}> {
  const limit = input.limit ?? 20;
  const concurrency = input.extractionConcurrency ?? EXTRACTION_CONCURRENCY;

  const recovery = await recoverAbandonedManualUploadJobs({
    client: input.client,
    companyId: input.companyId,
    limit,
  });

  logUploadProcessingEvent("pipeline_stage", {
    companyId: input.companyId,
    stage: "drain:recovery",
    outcome: "ok",
    requeuedProcessing: recovery.requeuedProcessingIds.length,
    staleExtracted: recovery.staleExtractedIds.length,
    recoveredAnalyzing: recovery.recoveredAnalyzingIds.length,
  });

  // Auto-enqueue version-stale PROCESSED docs (bounded batch).
  const versionUpgrade = await autoEnqueueVersionStaleDocuments({
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

  // Prefer recovered + version-upgrade enqueued + any QUEUED.
  const claimIds = [
    ...new Set([
      ...recovery.requeuedProcessingIds,
      ...versionUpgrade.enqueued,
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
      recoveredAnalyzing: recovery.recoveredAnalyzingIds.length,
    },
  };
}
