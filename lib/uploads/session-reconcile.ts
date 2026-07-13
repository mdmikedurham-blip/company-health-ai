/**
 * Session upload list reconciliation — identity is documentId only.
 * "This session" must mirror authoritative DB rows from GET /api/documents.
 */

import {
  IN_FLIGHT_UPLOAD_STATUSES,
  TERMINAL_UPLOAD_STATUSES,
} from "./constants";

/** How long a session card may stay non-terminal before surfacing an error. */
export const SESSION_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export const SESSION_POLL_TIMEOUT_MESSAGE =
  "Analysis is taking longer than expected. Retry processing, or refresh the page.";

export type SessionStatusSnapshot = {
  id: string;
  status: string;
  lastStage?: string | null;
  reprocessErrorMessage?: string | null;
  errorMessage?: string | null;
};

export type SessionUploadItem = {
  localId: string;
  /** Immutable document UUID once signing succeeds — never filename. */
  documentId?: string;
  status?: string;
  lastStage?: string | null;
  reprocessErrorMessage?: string | null;
  errorMessage?: string | null;
  /** Wall clock when this item entered (or re-entered) an in-flight status. */
  inFlightSinceMs?: number;
  /** Set when poll timeout fires; cleared on terminal / fresh in-flight. */
  pollError?: string;
  phase: string;
};

export function isInFlightUploadStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (IN_FLIGHT_UPLOAD_STATUSES as readonly string[]).includes(status);
}

export function isTerminalUploadStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (TERMINAL_UPLOAD_STATUSES as readonly string[]).includes(status);
}

/**
 * Merge authoritative document rows into session items by documentId.
 * - Updates status fields from DB
 * - Drops session rows whose document was deleted
 * - Clears poll errors on terminal status
 * - Tracks inFlightSinceMs for timeout
 */
export function reconcileSessionItems<T extends SessionUploadItem>(
  items: T[],
  documents: SessionStatusSnapshot[],
  nowMs: number = Date.now(),
): T[] {
  const byId = new Map(documents.map((d) => [d.id, d]));

  const next: T[] = [];
  for (const item of items) {
    if (!item.documentId) {
      // Still uploading — keep; no DB identity yet.
      next.push(item);
      continue;
    }

    const doc = byId.get(item.documentId);
    if (!doc) {
      // Deleted or gone from authoritative list — drop session card.
      continue;
    }

    const prevStatus = item.status;
    const status = doc.status;
    const becameInFlight =
      isInFlightUploadStatus(status) &&
      (!isInFlightUploadStatus(prevStatus) || item.inFlightSinceMs == null);
    const terminal = isTerminalUploadStatus(status);

    next.push({
      ...item,
      status,
      lastStage: doc.lastStage ?? null,
      reprocessErrorMessage: doc.reprocessErrorMessage ?? null,
      errorMessage: doc.errorMessage ?? null,
      inFlightSinceMs: terminal
        ? undefined
        : becameInFlight
          ? nowMs
          : item.inFlightSinceMs,
      // Clear timeout error on terminal or when a new in-flight window starts.
      pollError: terminal || becameInFlight ? undefined : item.pollError,
    });
  }
  return next;
}

/** Apply visible timeout errors for session items stuck in-flight too long. */
export function applySessionPollTimeouts<T extends SessionUploadItem>(
  items: T[],
  nowMs: number = Date.now(),
  timeoutMs: number = SESSION_POLL_TIMEOUT_MS,
): T[] {
  return items.map((item) => {
    if (!item.documentId || !isInFlightUploadStatus(item.status)) {
      return item.pollError ? { ...item, pollError: undefined } : item;
    }
    const since = item.inFlightSinceMs ?? nowMs;
    if (nowMs - since < timeoutMs) {
      return item.pollError ? { ...item, pollError: undefined } : item;
    }
    if (item.pollError === SESSION_POLL_TIMEOUT_MESSAGE) return item;
    return { ...item, pollError: SESSION_POLL_TIMEOUT_MESSAGE };
  });
}

/** Continue polling while Recent or Session has any non-terminal in-flight doc. */
export function shouldPollUploadLists(input: {
  recentStatuses: Array<string | undefined>;
  sessionStatuses: Array<string | undefined>;
}): boolean {
  return (
    input.recentStatuses.some(isInFlightUploadStatus) ||
    input.sessionStatuses.some(isInFlightUploadStatus)
  );
}

/**
 * Skip reprocess when the document is already actively processing.
 * Prevents duplicate analysis jobs from repeated Reprocess clicks.
 */
export function shouldSkipReprocess(status: string | undefined): boolean {
  if (!status) return false;
  return (
    status === "QUEUED" ||
    status === "PROCESSING" ||
    status === "EXTRACTED" ||
    status === "ANALYZING" ||
    status === "UPLOADED" ||
    status === "DELETING"
  );
}
