import {
  PROCESSING_STALE_MS,
  QUEUED_RETRY_AFTER_MS,
  REMOVAL_BLOCKED_STATUSES,
  REMOVABLE_DOCUMENT_STATUSES,
} from "./constants";
import { canonicalizeEvidenceUuid } from "./evidence-id";

export function isLeaseExpired(
  row: {
    status: string;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
    updated_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (row.lease_expires_at) {
    return new Date(row.lease_expires_at).getTime() <= now.getTime();
  }
  const anchor =
    row.locked_at ?? row.processing_started_at ?? row.updated_at ?? null;
  if (!anchor) return true;
  return now.getTime() - new Date(anchor).getTime() >= PROCESSING_STALE_MS;
}

export function isActivelyProcessing(
  row: {
    status: string;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
    updated_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  // EXTRACTED is parked (lease cleared) and removable — not "actively processing".
  if (!["PROCESSING", "ANALYZING"].includes(row.status)) {
    return false;
  }
  return !isLeaseExpired(row, now);
}

/**
 * Removal is blocked while PROCESSING or ANALYZING with a live lease.
 * EXTRACTED is removable (parked awaiting company analysis).
 */
export function isRemovalBlocked(
  row: {
    status: string;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
    updated_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!(REMOVAL_BLOCKED_STATUSES as readonly string[]).includes(row.status)) {
    return false;
  }
  return !isLeaseExpired(row, now);
}

export const REMOVE_CONFIRM_UNPROCESSED = "Remove this file?";
export const REMOVE_CONFIRM_PROCESSED =
  "Remove this file and rebuild the company analysis without it?";
export const PROCESSING_IN_PROGRESS_LABEL = "Processing in progress";

export function removeConfirmMessage(status: string): string {
  if (status === "PROCESSED" || status === "DELETING") {
    return REMOVE_CONFIRM_PROCESSED;
  }
  return REMOVE_CONFIRM_UNPROCESSED;
}

export function requiresAnalysisRebuildOnRemove(status: string): boolean {
  return status === "PROCESSED" || status === "DELETING";
}

/** Whether Remove is allowed for this document status/lease. */
export function canRemoveDocument(
  row: {
    status: string;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
    updated_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (isRemovalBlocked(row, now)) return false;
  if ((REMOVABLE_DOCUMENT_STATUSES as readonly string[]).includes(row.status)) {
    return true;
  }
  // Stale PROCESSING may be removed after lease expiry.
  if (row.status === "PROCESSING" && isLeaseExpired(row, now)) return true;
  if (row.status === "ANALYZING" && isLeaseExpired(row, now)) return true;
  return false;
}

/** Queued long enough to show Retry. */
export function canRetryQueuedDocument(
  row: { status: string; updated_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (row.status === "FAILED") return true;
  if (row.status !== "QUEUED" || !row.updated_at) return false;
  return now.getTime() - new Date(row.updated_at).getTime() >= QUEUED_RETRY_AFTER_MS;
}

export function canCancelDocument(
  row: {
    status: string;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
    updated_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  return isActivelyProcessing(row, now);
}

export type ManualUploadRowAction = "retry" | "remove" | "cancel";

/**
 * Visible per-row actions for the recent uploads list.
 * Cancel only for live PROCESSING/ANALYZING; Remove for parked EXTRACTED.
 */
export function visibleManualUploadActions(
  row: {
    status: string;
    updated_at?: string | null;
    lease_expires_at?: string | null;
    locked_at?: string | null;
    processing_started_at?: string | null;
  },
  now: Date = new Date(),
): ManualUploadRowAction[] {
  const actions: ManualUploadRowAction[] = [];

  if (canCancelDocument(row, now)) {
    actions.push("cancel");
    // Still allow Remove only when not blocked (stale leases use Remove, not Cancel).
    return actions;
  }

  if (canRetryQueuedDocument(row, now)) {
    actions.push("retry");
  }

  // Allow re-extraction of completed / OCR / stale docs (extractor upgrades).
  if (
    (row.status === "PROCESSED" ||
      row.status === "STALE" ||
      row.status === "OCR_REQUIRED") &&
    !actions.includes("retry")
  ) {
    actions.push("retry");
  }

  if (canRemoveDocument(row, now)) {
    actions.push("remove");
  }

  return actions;
}

export function evidenceIdForManualUpload(documentId: string): string {
  // evidence.id is uuid — use the document row id as the canonical evidence PK.
  // Also strips legacy `upload-` / `upload:` prefixes if a caller still passes them.
  return canonicalizeEvidenceUuid(documentId, "evidenceIdForManualUpload");
}

export {
  manualUploadExternalKey,
  canonicalizeEvidenceUuid,
  isUuid,
} from "./evidence-id";

export const CANCELLED_LAST_STAGE = "cancelled" as const;
export const CANCELLED_ERROR = "cancelled_by_user" as const;

export function isCancelledDocument(row: {
  status: string;
  last_stage?: string | null;
  error_message?: string | null;
}): boolean {
  return (
    row.status === "FAILED" &&
    (row.last_stage === CANCELLED_LAST_STAGE ||
      row.error_message === CANCELLED_ERROR)
  );
}
