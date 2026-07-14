import {
  IN_FLIGHT_UPLOAD_STATUSES,
  progressLabelForStatus,
  TERMINAL_UPLOAD_STATUSES,
  type UploadProgressLabel,
} from "./constants";
import { pipelineUiStateFromDocument } from "./pipeline";

export type UploadProgressItem = {
  id: string;
  filename: string;
  status: string;
  label: UploadProgressLabel | string;
  errorMessage: string | null;
  updatedAt: string;
  processingStartedAt: string | null;
  pipelineStep: string | null;
  waitingReason: string | null;
  failedStep: string | null;
  errorCategory: string | null;
  retryable: boolean;
};

export type DashboardProcessingState = {
  analysisReady: boolean;
  allTerminal: boolean;
  hasUploads: boolean;
  inFlight: boolean;
  /** @deprecated Use per-item waitingReason — never show a generic stalled banner. */
  stalled: boolean;
  items: UploadProgressItem[];
  overallLabel: UploadProgressLabel | string | "Idle";
};

export function buildUploadProgressItem(row: {
  id: string;
  filename: string | null;
  title: string;
  status: string;
  error_message?: string | null;
  updated_at: string;
  processing_started_at?: string | null;
  last_stage?: string | null;
  pipeline_step?: string | null;
  failed_step?: string | null;
  error_category?: string | null;
  retryable?: boolean | null;
  reprocess_error_message?: string | null;
}): UploadProgressItem {
  const ui = pipelineUiStateFromDocument({
    status: row.status,
    pipeline_step: row.pipeline_step,
    last_stage: row.last_stage,
    failed_step: row.failed_step,
    error_category: row.error_category,
    retryable: row.retryable,
    error_message: row.error_message,
  });
  return {
    id: row.id,
    filename: row.filename ?? row.title,
    status: row.status,
    label: progressLabelForStatus(row.status, {
      lastStage: row.last_stage,
      pipelineStep: row.pipeline_step ?? ui.step,
      failedStep: row.failed_step ?? ui.failedStep,
      reprocessErrorMessage: row.reprocess_error_message,
    }),
    errorMessage: row.error_message ?? null,
    updatedAt: row.updated_at,
    processingStartedAt: row.processing_started_at ?? null,
    pipelineStep: ui.step,
    waitingReason: ui.waitingReason,
    failedStep: ui.failedStep,
    errorCategory: ui.errorCategory,
    retryable: ui.retryable,
  };
}

export function computeDashboardProcessingState(input: {
  hasAnalysisSnapshot: boolean;
  uploads: Array<{
    id: string;
    filename: string | null;
    title: string;
    status: string;
    error_message?: string | null;
    updated_at: string;
    processing_started_at?: string | null;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    last_stage?: string | null;
    pipeline_step?: string | null;
    failed_step?: string | null;
    error_category?: string | null;
    retryable?: boolean | null;
    reprocess_error_message?: string | null;
  }>;
  now?: Date;
}): DashboardProcessingState {
  const items = input.uploads.map(buildUploadProgressItem);
  const hasUploads = items.length > 0;
  const allTerminal =
    hasUploads &&
    items.every((i) =>
      (TERMINAL_UPLOAD_STATUSES as string[]).includes(i.status),
    );
  const inFlight = items.some((i) =>
    (IN_FLIGHT_UPLOAD_STATUSES as string[]).includes(i.status),
  );

  const analysisReady = input.hasAnalysisSnapshot || allTerminal;

  let overallLabel: UploadProgressLabel | string | "Idle" = "Idle";
  if (items.some((i) => i.status === "FAILED") && allTerminal) {
    overallLabel = items.find((i) => i.status === "FAILED")?.label ?? "Failed";
  } else if (items.some((i) => i.status === "ANALYZING")) {
    overallLabel = "Company assessment update";
  } else if (
    items.some((i) => i.status === "PROCESSING" || i.status === "EXTRACTED")
  ) {
    const active = items.find(
      (i) => i.status === "PROCESSING" || i.status === "EXTRACTED",
    );
    overallLabel = active?.label ?? "Text extraction";
  } else if (items.some((i) => i.status === "QUEUED")) {
    overallLabel = "Queued";
  } else if (items.some((i) => i.status === "UPLOADED")) {
    overallLabel = "Uploading";
  } else if (items.some((i) => i.status === "PROCESSED")) {
    overallLabel = "Current";
  }

  return {
    analysisReady,
    allTerminal,
    hasUploads,
    inFlight,
    stalled: false,
    items,
    overallLabel,
  };
}
