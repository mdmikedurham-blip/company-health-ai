/**
 * Deterministic document processing pipeline.
 *
 * Coarse `status` (QUEUED/PROCESSING/…) remains the queue state machine.
 * `pipeline_step` is the durable, user-visible stage within that machine.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { logUploadProcessingEvent } from "./logging";

/** Ordered pipeline — never skip ahead without recording success. */
export const PIPELINE_STEPS = [
  "upload",
  "storage",
  "text_extraction",
  "ocr",
  "classification",
  "structured_fact_extraction",
  "finding_generation",
  "company_assessment_update",
  "complete",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export type PipelineErrorCategory =
  | "timeout"
  | "storage"
  | "extraction"
  | "ocr"
  | "classification"
  | "analysis"
  | "internal"
  | "cancelled";

export type PipelineStepHistoryEntry = {
  step: PipelineStep;
  at: string;
  outcome: "started" | "succeeded" | "failed" | "skipped" | "waiting";
  detail?: string;
};

/** No heartbeat for this long → reclaim and continue from last successful step. */
export const PIPELINE_HEARTBEAT_STALE_MS = 60 * 1000;

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  upload: "Upload",
  storage: "Storage",
  text_extraction: "Text extraction",
  ocr: "OCR",
  classification: "Classification",
  structured_fact_extraction: "Structured fact extraction",
  finding_generation: "Finding generation",
  company_assessment_update: "Company assessment update",
  complete: "Complete",
};

/** Why a non-failed document may be waiting at this step. */
export const PIPELINE_WAITING_REASONS: Record<PipelineStep, string> = {
  upload: "Waiting for the browser to finish sending the file.",
  storage: "Waiting for the file to be verified in private storage.",
  text_extraction: "Extracting readable text from the uploaded file.",
  ocr: "Waiting for OCR because text extraction found no usable text.",
  classification: "Classifying the document type and relevant health dimensions.",
  structured_fact_extraction: "Extracting structured financial and operating facts.",
  finding_generation: "Generating findings from extracted evidence.",
  company_assessment_update:
    "Updating the company health snapshot from all extracted evidence.",
  complete: "Processing finished.",
};

export function isPipelineStep(value: string | null | undefined): value is PipelineStep {
  return (
    typeof value === "string" &&
    (PIPELINE_STEPS as readonly string[]).includes(value)
  );
}

export function pipelineStepIndex(step: PipelineStep): number {
  return PIPELINE_STEPS.indexOf(step);
}

export function pipelineStepLabel(step: string | null | undefined): string {
  if (isPipelineStep(step)) return PIPELINE_STEP_LABELS[step];
  return step ? step.replace(/_/g, " ") : "Queued";
}

export function nextPipelineStep(
  lastSuccessful: PipelineStep | null | undefined,
): PipelineStep {
  if (!lastSuccessful) return "upload";
  const idx = pipelineStepIndex(lastSuccessful);
  if (idx < 0 || idx >= PIPELINE_STEPS.length - 1) return "complete";
  return PIPELINE_STEPS[idx + 1]!;
}

/** Resume point: failed step if set, else next after last success. */
export function resumePipelineStep(input: {
  failedStep?: string | null;
  lastSuccessfulStep?: string | null;
}): PipelineStep {
  if (isPipelineStep(input.failedStep)) return input.failedStep;
  if (isPipelineStep(input.lastSuccessfulStep)) {
    return nextPipelineStep(input.lastSuccessfulStep);
  }
  return "upload";
}

export function shouldSkipPipelineStep(
  step: PipelineStep,
  lastSuccessful: string | null | undefined,
): boolean {
  if (!isPipelineStep(lastSuccessful)) return false;
  return pipelineStepIndex(step) <= pipelineStepIndex(lastSuccessful);
}

export function categorizePipelineError(
  errorMessage: string,
  step: PipelineStep,
): { category: PipelineErrorCategory; retryable: boolean } {
  const msg = errorMessage.toLowerCase();
  if (msg.includes("cancelled_by_user") || msg.includes("cancelled")) {
    return { category: "cancelled", retryable: false };
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return { category: "timeout", retryable: true };
  }
  if (
    msg.includes("download") ||
    msg.includes("storage") ||
    msg.includes("bucket") ||
    msg.includes("object not found")
  ) {
    return { category: "storage", retryable: true };
  }
  if (msg.includes("ocr")) {
    return { category: "ocr", retryable: true };
  }
  if (
    step === "text_extraction" ||
    msg.includes("extract") ||
    msg.includes("empty text") ||
    msg.includes("unsupported mime")
  ) {
    return { category: "extraction", retryable: true };
  }
  if (step === "classification") {
    return { category: "classification", retryable: true };
  }
  if (
    step === "finding_generation" ||
    step === "company_assessment_update" ||
    msg.includes("analysis") ||
    msg.includes("snapshot")
  ) {
    return { category: "analysis", retryable: true };
  }
  return { category: "internal", retryable: true };
}

export function appendPipelineHistory(
  existing: unknown,
  entry: PipelineStepHistoryEntry,
  maxEntries = 40,
): PipelineStepHistoryEntry[] {
  const prev = Array.isArray(existing)
    ? (existing as PipelineStepHistoryEntry[])
    : [];
  return [...prev, entry].slice(-maxEntries);
}

export type PipelineUiState = {
  step: PipelineStep | null;
  label: string;
  waitingReason: string | null;
  failedStep: PipelineStep | null;
  failedStepLabel: string | null;
  errorCategory: PipelineErrorCategory | null;
  retryable: boolean;
  lastSuccessfulStep: PipelineStep | null;
};

export function pipelineUiStateFromDocument(doc: {
  status?: string | null;
  pipeline_step?: string | null;
  pipelineStep?: string | null;
  last_stage?: string | null;
  lastStage?: string | null;
  failed_step?: string | null;
  failedStep?: string | null;
  error_category?: string | null;
  errorCategory?: string | null;
  retryable?: boolean | null;
  last_successful_pipeline_step?: string | null;
  lastSuccessfulPipelineStep?: string | null;
  error_message?: string | null;
  errorMessage?: string | null;
}): PipelineUiState {
  const rawStep =
    doc.pipelineStep ??
    doc.pipeline_step ??
    mapLegacyStageToPipelineStep(doc.lastStage ?? doc.last_stage) ??
    mapStatusToPipelineStep(doc.status);
  const step = isPipelineStep(rawStep) ? rawStep : null;
  const failedRaw = doc.failedStep ?? doc.failed_step;
  const failedStep = isPipelineStep(failedRaw) ? failedRaw : null;
  const lastSuccessfulRaw =
    doc.lastSuccessfulPipelineStep ?? doc.last_successful_pipeline_step;
  const lastSuccessfulStep = isPipelineStep(lastSuccessfulRaw)
    ? lastSuccessfulRaw
    : null;
  const errorCategory = (doc.errorCategory ??
    doc.error_category) as PipelineErrorCategory | null;
  const failed = doc.status === "FAILED" || failedStep != null;

  return {
    step,
    label: failed && failedStep
      ? `Failed at ${PIPELINE_STEP_LABELS[failedStep]}`
      : pipelineStepLabel(step),
    waitingReason: failed
      ? null
      : step
        ? PIPELINE_WAITING_REASONS[step]
        : "Waiting to be claimed by the processing worker.",
    failedStep,
    failedStepLabel: failedStep ? PIPELINE_STEP_LABELS[failedStep] : null,
    errorCategory: failed ? errorCategory : null,
    retryable: failed ? doc.retryable !== false : false,
    lastSuccessfulStep,
  };
}

export function mapStatusToPipelineStep(
  status: string | null | undefined,
): PipelineStep | null {
  switch (status) {
    case "UPLOADED":
      return "upload";
    case "QUEUED":
      return "storage";
    case "PROCESSING":
      return "text_extraction";
    case "OCR_REQUIRED":
      return "ocr";
    case "EXTRACTED":
      return "finding_generation";
    case "ANALYZING":
      return "company_assessment_update";
    case "PROCESSED":
      return "complete";
    default:
      return null;
  }
}

export function mapLegacyStageToPipelineStep(
  lastStage: string | null | undefined,
): PipelineStep | null {
  if (!lastStage) return null;
  if (isPipelineStep(lastStage)) return lastStage;
  switch (lastStage) {
    case "claim":
    case "kickoff":
      return "storage";
    case "extracting":
      return "text_extraction";
    case "extracted":
      return "structured_fact_extraction";
    case "analyzing":
      return "company_assessment_update";
    case "processed":
      return "complete";
    case "ocr_required":
      return "ocr";
    default:
      return null;
  }
}

/** Queue status that should accompany a pipeline step. */
export function statusForPipelineStep(step: PipelineStep): string {
  switch (step) {
    case "upload":
      return "UPLOADED";
    case "storage":
      return "QUEUED";
    case "text_extraction":
    case "classification":
    case "structured_fact_extraction":
      return "PROCESSING";
    case "ocr":
      return "OCR_REQUIRED";
    case "finding_generation":
      return "EXTRACTED";
    case "company_assessment_update":
      return "ANALYZING";
    case "complete":
      return "PROCESSED";
  }
}

/**
 * Advance (or start) a pipeline step: persists step, heartbeat, history,
 * and mirrors into last_stage for older readers.
 */
export async function advancePipelineStep(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  step: PipelineStep;
  outcome?: "started" | "succeeded" | "skipped" | "waiting";
  detail?: string;
  /** When true, mark this step as last successful. */
  markSuccessful?: boolean;
  status?: string;
  existingHistory?: unknown;
  patch?: TablesUpdate<"documents">;
}): Promise<void> {
  const now = new Date().toISOString();
  const outcome = input.outcome ?? "started";
  const history = appendPipelineHistory(input.existingHistory, {
    step: input.step,
    at: now,
    outcome,
    detail: input.detail,
  }) as Json;

  const rich: TablesUpdate<"documents"> = {
    pipeline_step: input.step,
    pipeline_heartbeat_at: now,
    pipeline_steps: history,
    last_stage: input.step,
    failed_step: null,
    error_category: null,
    retryable: null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.markSuccessful
      ? { last_successful_pipeline_step: input.step }
      : {}),
    ...input.patch,
  };

  const { error } = await input.client
    .from("documents")
    .update(rich)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (!error) {
    logUploadProcessingEvent("pipeline_step", {
      documentId: input.documentId,
      companyId: input.companyId,
      stage: input.step,
      outcome,
      status: input.status,
      detail: input.detail,
    });
    return;
  }

  // Columns from migration 023 missing — fall back to last_stage + metadata.
  const { error: fallbackError } = await input.client
    .from("documents")
    .update({
      ...(input.status ? { status: input.status } : {}),
      last_stage: input.step,
      metadata: {
        source: "manual-upload",
        pipeline_step: input.step,
        last_successful_pipeline_step: input.markSuccessful
          ? input.step
          : undefined,
        pipeline_heartbeat_at: now,
        pipeline_steps: history,
        last_stage: input.step,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (fallbackError) {
    throw new Error(
      `advancePipelineStep: ${error.message}; fallback: ${fallbackError.message}`,
    );
  }

  logUploadProcessingEvent("pipeline_step", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: input.step,
    outcome,
    status: input.status,
    detail: input.detail ?? "metadata_fallback",
  });
}

export async function heartbeatPipelineStep(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  step?: PipelineStep;
}): Promise<void> {
  const now = new Date().toISOString();
  const patch: TablesUpdate<"documents"> = {
    pipeline_heartbeat_at: now,
    ...(input.step ? { pipeline_step: input.step, last_stage: input.step } : {}),
  };
  const { error } = await input.client
    .from("documents")
    .update(patch)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (!error) return;

  await input.client
    .from("documents")
    .update({
      last_stage: input.step ?? undefined,
      metadata: {
        source: "manual-upload",
        pipeline_heartbeat_at: now,
        pipeline_step: input.step,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);
}

export async function failPipelineStep(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  step: PipelineStep;
  errorMessage: string;
  existingHistory?: unknown;
}): Promise<{ category: PipelineErrorCategory; retryable: boolean }> {
  const { category, retryable } = categorizePipelineError(
    input.errorMessage,
    input.step,
  );
  const now = new Date().toISOString();
  const history = appendPipelineHistory(input.existingHistory, {
    step: input.step,
    at: now,
    outcome: "failed",
    detail: input.errorMessage.slice(0, 500),
  }) as Json;
  const message = input.errorMessage.slice(0, 1000);

  const rich: TablesUpdate<"documents"> = {
    status: "FAILED",
    pipeline_step: input.step,
    failed_step: input.step,
    error_category: category,
    retryable,
    error_message: message,
    last_stage: input.step,
    pipeline_steps: history,
    pipeline_heartbeat_at: null,
    processing_completed_at: now,
    lease_expires_at: null,
    locked_at: null,
  };

  const { error } = await input.client
    .from("documents")
    .update(rich)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (error) {
    await input.client
      .from("documents")
      .update({
        status: "FAILED",
        last_stage: input.step,
        error_message: message,
        metadata: {
          source: "manual-upload",
          failed_step: input.step,
          error_category: category,
          retryable,
          pipeline_steps: history,
          error: message,
        },
      })
      .eq("id", input.documentId)
      .eq("company_id", input.companyId);
  }

  logUploadProcessingEvent("pipeline_step", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: input.step,
    outcome: "failed",
    status: "FAILED",
    errorMessage: message.slice(0, 500),
    errorCategory: category,
    retryable,
  });

  return { category, retryable };
}

/**
 * Requeue a failed (or stuck) document to resume at a specific step —
 * does not wipe earlier successful stages.
 */
export async function requeueFromPipelineStep(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  resumeStep: PipelineStep;
  lastSuccessfulStep?: string | null;
  reason: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const status = statusForPipelineStep(input.resumeStep);
  // Assessment-phase resumes park at EXTRACTED so company analysis can reclaim.
  // OCR/complete force a queue claim. Other steps use their natural status.
  const queueStatus =
    input.resumeStep === "finding_generation" ||
    input.resumeStep === "company_assessment_update"
      ? "EXTRACTED"
      : status === "OCR_REQUIRED" || status === "PROCESSED" || status === "UPLOADED"
        ? "QUEUED"
        : status === "ANALYZING"
          ? "EXTRACTED"
          : status;
  const { error } = await input.client
    .from("documents")
    .update({
      status: queueStatus,
      pipeline_step: input.resumeStep,
      last_stage: input.resumeStep,
      failed_step: null,
      error_category: null,
      retryable: null,
      error_message: null,
      locked_at: null,
      lease_expires_at: null,
      processing_completed_at: null,
      pipeline_heartbeat_at: now,
      metadata: {
        source: "manual-upload",
        resume_step: input.resumeStep,
        last_successful_pipeline_step: input.lastSuccessfulStep ?? null,
        recovery_reason: input.reason,
        recovered_at: now,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (error) {
    await input.client
      .from("documents")
      .update({
        status: "QUEUED",
        last_stage: input.resumeStep,
        error_message: null,
        metadata: {
          source: "manual-upload",
          resume_step: input.resumeStep,
          recovery_reason: input.reason,
        },
      })
      .eq("id", input.documentId)
      .eq("company_id", input.companyId);
  }

  logUploadProcessingEvent("pipeline_step", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: input.resumeStep,
    outcome: "waiting",
    status: queueStatus,
    detail: input.reason,
  });
}
