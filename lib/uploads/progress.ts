import {
  IN_FLIGHT_UPLOAD_STATUSES,
  PROCESSING_STALE_MS,
  progressLabelForStatus,
  TERMINAL_UPLOAD_STATUSES,
  type UploadProgressLabel,
} from "./constants";

export type UploadProgressItem = {
  id: string;
  filename: string;
  status: string;
  label: UploadProgressLabel;
  errorMessage: string | null;
  updatedAt: string;
  processingStartedAt: string | null;
};

export type DashboardProcessingState = {
  analysisReady: boolean;
  allTerminal: boolean;
  hasUploads: boolean;
  inFlight: boolean;
  stalled: boolean;
  items: UploadProgressItem[];
  overallLabel: UploadProgressLabel | "Idle";
};

export function buildUploadProgressItem(row: {
  id: string;
  filename: string | null;
  title: string;
  status: string;
  error_message?: string | null;
  updated_at: string;
  processing_started_at?: string | null;
}): UploadProgressItem {
  return {
    id: row.id,
    filename: row.filename ?? row.title,
    status: row.status,
    label: progressLabelForStatus(row.status),
    errorMessage: row.error_message ?? null,
    updatedAt: row.updated_at,
    processingStartedAt: row.processing_started_at ?? null,
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
  }>;
  now?: Date;
}): DashboardProcessingState {
  const now = input.now ?? new Date();
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

  const stalled = items.some((item) => {
    if ((TERMINAL_UPLOAD_STATUSES as string[]).includes(item.status)) {
      return false;
    }
    const anchor =
      item.processingStartedAt ??
      item.updatedAt;
    return now.getTime() - new Date(anchor).getTime() >= PROCESSING_STALE_MS;
  });

  const analysisReady = input.hasAnalysisSnapshot || allTerminal;

  let overallLabel: UploadProgressLabel | "Idle" = "Idle";
  if (items.some((i) => i.status === "FAILED") && allTerminal) {
    overallLabel = "Failed";
  } else if (items.some((i) => i.status === "ANALYZING")) {
    overallLabel = "Analyzing";
  } else if (
    items.some((i) => i.status === "PROCESSING" || i.status === "EXTRACTED")
  ) {
    overallLabel = "Extracting";
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
    stalled,
    items,
    overallLabel,
  };
}
