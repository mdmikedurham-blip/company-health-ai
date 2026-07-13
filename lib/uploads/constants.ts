/** Manual upload connector id — distinct from google-drive inventory. */
export const MANUAL_UPLOAD_CONNECTOR_ID = "manual-upload" as const;

export const COMPANY_DOCUMENTS_BUCKET = "company-documents" as const;

/** 50 MiB — matches storage.buckets.file_size_limit in migration 007. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Lease length for PROCESSING jobs; stale after this window. */
export const PROCESSING_LEASE_SECONDS = 5 * 60;

/** In-flight PROCESSING jobs are retryable after this long. */
export const PROCESSING_STALE_MS = 5 * 60 * 1000;

/** Queued jobs are retryable after this long (Retry Processing). */
export const QUEUED_RETRY_AFTER_MS = 60 * 1000;

/**
 * Wall-clock budget for download + extract + evidence upsert.
 * Override with MANUAL_UPLOAD_EXTRACTION_TIMEOUT_MS (ms).
 * Must stay below PROCESSING_LEASE_SECONDS so timeouts clear state before lease reclaim.
 */
export const EXTRACTION_TIMEOUT_MS = (() => {
  const raw = Number(process.env.MANUAL_UPLOAD_EXTRACTION_TIMEOUT_MS ?? "");
  if (Number.isFinite(raw) && raw >= 30_000 && raw <= 10 * 60_000) return raw;
  return 3 * 60 * 1000; // 3 minutes
})();

/** Storage download alone may not exceed this share of the extraction budget. */
export const DOWNLOAD_TIMEOUT_MS = Math.min(
  EXTRACTION_TIMEOUT_MS,
  2 * 60 * 1000,
);

/** EXTRACTED docs older than this without progressing are abandoned. */
export const STALE_EXTRACTED_MS = 2 * 60 * 1000;

/**
 * ANALYZING docs older than this are treated as abandoned workers
 * (e.g. waitUntil killed mid-analysis) and reset to EXTRACTED for retry.
 */
export const STALE_ANALYZING_MS = 90 * 1000;

/** Soft wall-clock budget for a company analysis persist pass. */
export const COMPANY_ANALYSIS_TIMEOUT_MS = (() => {
  const raw = Number(process.env.MANUAL_UPLOAD_ANALYSIS_TIMEOUT_MS ?? "");
  if (Number.isFinite(raw) && raw >= 15_000 && raw <= 5 * 60_000) return raw;
  return 45 * 1000;
})();

export const UPLOAD_DOCUMENT_STATUSES = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "EXTRACTED",
  "ANALYZING",
  "PROCESSED",
  "FAILED",
  "DELETING",
  "STALE",
  "OCR_REQUIRED",
] as const;

export type UploadDocumentStatus = (typeof UPLOAD_DOCUMENT_STATUSES)[number];

export const TERMINAL_UPLOAD_STATUSES: UploadDocumentStatus[] = [
  "PROCESSED",
  "FAILED",
  "OCR_REQUIRED",
];

export const IN_FLIGHT_UPLOAD_STATUSES: UploadDocumentStatus[] = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "EXTRACTED",
  "ANALYZING",
  "DELETING",
  "STALE",
];

/** Statuses where removal is blocked while a lease is active. */
export const REMOVAL_BLOCKED_STATUSES: UploadDocumentStatus[] = [
  "PROCESSING",
  "ANALYZING",
];

/** Removable without waiting for lease expiry (when not actively processing). */
export const REMOVABLE_DOCUMENT_STATUSES: UploadDocumentStatus[] = [
  "UPLOADED",
  "QUEUED",
  "EXTRACTED",
  "FAILED",
  "PROCESSED",
  "DELETING",
  "STALE",
  "OCR_REQUIRED",
];

/**
 * First-class manual upload MIME types.
 */
export const MANUAL_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

export type ManualUploadMimeType = (typeof MANUAL_UPLOAD_MIME_TYPES)[number];

export const MANUAL_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".txt",
  ".csv",
] as const;

export const MANUAL_UPLOAD_ACCEPT = MANUAL_UPLOAD_EXTENSIONS.join(",");

export const MANUAL_UPLOAD_FORMAT_LABELS = [
  "PDF",
  "DOCX",
  "PPTX",
  "XLSX",
  "TXT",
  "CSV",
] as const;

const EXT_TO_MIME: Record<string, ManualUploadMimeType> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export function mimeFromFilename(filename: string): ManualUploadMimeType | null {
  const lower = filename.toLowerCase();
  const ext = MANUAL_UPLOAD_EXTENSIONS.find((e) => lower.endsWith(e));
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

/** User-facing progress labels for dashboard / upload UI. */
export type UploadProgressLabel =
  | "Uploading"
  | "Queued"
  | "Extracting"
  | "Analyzing"
  | "Deleting"
  | "Current"
  | "Reprocessing"
  | "Update available"
  | "Reprocess failed — previous analysis retained"
  | "OCR required"
  | "Failed";

export function progressLabelForStatus(
  status: string,
  opts?: {
    reprocessErrorMessage?: string | null;
    lastStage?: string | null;
  },
): UploadProgressLabel {
  if (
    status === "PROCESSED" &&
    (opts?.reprocessErrorMessage ||
      opts?.lastStage === "reprocess_failed")
  ) {
    return "Reprocess failed — previous analysis retained";
  }
  switch (status) {
    case "UPLOADED":
      return "Uploading";
    case "QUEUED":
      return opts?.lastStage === "version_stale" ||
        opts?.lastStage === "requeued_stale"
        ? "Reprocessing"
        : "Queued";
    case "PROCESSING":
    case "EXTRACTED":
    case "ANALYZING":
      return status === "PROCESSING" ? "Extracting" : "Analyzing";
    case "STALE":
      return "Update available";
    case "PROCESSED":
      return "Current";
    case "DELETING":
      return "Deleting";
    case "OCR_REQUIRED":
      return "OCR required";
    case "FAILED":
      return "Failed";
    default:
      return "Queued";
  }
}
