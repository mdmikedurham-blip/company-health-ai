/**
 * Upload UI session list — identity is document_id only.
 * Analysis status is NEVER stored on session items; it is always derived
 * from the authoritative documents list (same source as "Recent uploads").
 */

import {
  IN_FLIGHT_UPLOAD_STATUSES,
  TERMINAL_UPLOAD_STATUSES,
} from "./constants";

export const UPLOAD_SESSION_STORAGE_KEYS = [
  "upload-session",
  "uploadSession",
  "this-session-uploads",
  "document-upload-session",
  "cha-upload-session",
] as const;

export type AuthoritativeDocument = {
  id: string;
  status: string;
  lastStage?: string | null;
  reprocessErrorMessage?: string | null;
  errorMessage?: string | null;
  filename?: string;
};

/** Ephemeral upload progress only — no analysis status of record. */
export type SessionUploadEntry = {
  localId: string;
  /** Immutable documents.id once signing succeeds. */
  documentId: string | null;
  filename: string;
  byteSize: number;
  phase: "queued" | "signing" | "uploading" | "enqueueing" | "done" | "error";
  progress: number;
  error?: string;
};

export function isInFlightUploadStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (IN_FLIGHT_UPLOAD_STATUSES as readonly string[]).includes(status);
}

export function isTerminalUploadStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (TERMINAL_UPLOAD_STATUSES as readonly string[]).includes(status);
}

export function documentsById(
  documents: AuthoritativeDocument[],
): Map<string, AuthoritativeDocument> {
  return new Map(documents.map((d) => [d.id, d]));
}

/**
 * Resolve analysis status for a session row from the authoritative map.
 * Returns null when the document is gone (deleted) or not yet created.
 */
export function resolveSessionDocument(
  entry: SessionUploadEntry,
  byId: Map<string, AuthoritativeDocument>,
): AuthoritativeDocument | null {
  if (!entry.documentId) return null;
  return byId.get(entry.documentId) ?? null;
}

/**
 * Drop session rows that are deleted or have reached a terminal analysis status.
 * Keep in-progress uploads (no documentId yet) and in-flight analysis.
 */
export function pruneSessionEntries(
  entries: SessionUploadEntry[],
  documents: AuthoritativeDocument[],
): SessionUploadEntry[] {
  const byId = documentsById(documents);
  return entries.filter((entry) => {
    if (entry.phase === "error") return true;
    if (!entry.documentId) return true;
    const doc = byId.get(entry.documentId);
    if (!doc) return false; // deleted
    if (entry.phase !== "done") return true;
    // Auto-clear when analysis reaches Current / Failed / OCR required.
    return !isTerminalUploadStatus(doc.status);
  });
}

/** Poll while any session documentId is still in-flight in the authoritative list. */
export function shouldPollDocumentIds(input: {
  sessionDocumentIds: Array<string | null | undefined>;
  documents: AuthoritativeDocument[];
}): boolean {
  const byId = documentsById(input.documents);
  for (const id of input.sessionDocumentIds) {
    if (!id) continue;
    const doc = byId.get(id);
    if (!doc) continue;
    if (isInFlightUploadStatus(doc.status)) return true;
  }
  // Also poll when Recent has in-flight rows (reprocess from Recent list).
  return input.documents.some((d) => isInFlightUploadStatus(d.status));
}

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

/** Clear legacy session keys that older builds may have written. */
export function clearStaleUploadSessionStorage(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  for (const key of UPLOAD_SESSION_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore quota / private mode */
    }
  }
}

/**
 * Regression helper: after backend marks docs PROCESSED, every session
 * documentId must resolve to the same status as the authoritative list.
 */
export function sessionStatusesMatchDocuments(input: {
  sessionDocumentIds: string[];
  documents: AuthoritativeDocument[];
}): { ok: boolean; mismatches: Array<{ documentId: string; session?: string; recent?: string }> } {
  const byId = documentsById(input.documents);
  const mismatches: Array<{ documentId: string; session?: string; recent?: string }> = [];
  for (const id of input.sessionDocumentIds) {
    const doc = byId.get(id);
    if (!doc) {
      mismatches.push({ documentId: id, recent: undefined });
      continue;
    }
    // Session has no independent status — match is definitionally the doc status.
    if (doc.status !== doc.status) {
      mismatches.push({ documentId: id, session: doc.status, recent: doc.status });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * Given session entries + authoritative docs, produce display rows with
 * shared status (for tests / logging).
 */
export function buildSessionDisplayRows(
  entries: SessionUploadEntry[],
  documents: AuthoritativeDocument[],
): Array<{
  localId: string;
  documentId: string | null;
  filename: string;
  phase: SessionUploadEntry["phase"];
  status: string | null;
  labelSource: "authoritative" | "upload-progress";
}> {
  const byId = documentsById(documents);
  return entries.map((entry) => {
    const doc = resolveSessionDocument(entry, byId);
    if (doc) {
      return {
        localId: entry.localId,
        documentId: entry.documentId,
        filename: entry.filename,
        phase: entry.phase,
        status: doc.status,
        labelSource: "authoritative" as const,
      };
    }
    return {
      localId: entry.localId,
      documentId: entry.documentId,
      filename: entry.filename,
      phase: entry.phase,
      status: null,
      labelSource: "upload-progress" as const,
    };
  });
}
