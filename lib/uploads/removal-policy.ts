import {
  PROCESSING_STALE_MS,
  QUEUED_RETRY_AFTER_MS,
} from "./constants";

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
  if (!["PROCESSING", "EXTRACTED", "ANALYZING"].includes(row.status)) {
    return false;
  }
  return !isLeaseExpired(row, now);
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
  if (["UPLOADED", "QUEUED", "FAILED"].includes(row.status)) return true;
  if (
    ["PROCESSING", "EXTRACTED", "ANALYZING"].includes(row.status) &&
    isLeaseExpired(row, now)
  ) {
    return true;
  }
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
 * PROCESSED has no remove here (archive/delete is a separate flow).
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
    return actions;
  }

  if (canRetryQueuedDocument(row, now)) {
    actions.push("retry");
  }

  if (canRemoveDocument(row, now) && row.status !== "PROCESSED") {
    actions.push("remove");
  }

  return actions;
}

export function evidenceIdForManualUpload(documentId: string): string {
  return `upload-${documentId}`;
}

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
