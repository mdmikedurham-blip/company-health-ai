"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MANUAL_UPLOAD_ACCEPT,
  MANUAL_UPLOAD_FORMAT_LABELS,
  MAX_UPLOAD_BYTES,
  progressLabelForStatus,
} from "@/lib/uploads/constants";
import {
  PROCESSING_IN_PROGRESS_LABEL,
  isRemovalBlocked,
  removeConfirmMessage,
  visibleManualUploadActions,
  type ManualUploadRowAction,
} from "@/lib/uploads/removal-policy";
import {
  clearStaleUploadSessionStorage,
  documentsById,
  isInFlightUploadStatus,
  pruneSessionEntries,
  resolveSessionDocument,
  shouldPollDocumentIds,
  shouldSkipReprocess,
  type SessionUploadEntry,
} from "@/lib/uploads/session-reconcile";

type UploadedDocumentRecord = {
  id: string;
  companyId: string;
  filename: string;
  mimeType: string | null;
  byteSize: number | null;
  storagePath: string | null;
  status: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt?: string | null;
  leaseExpiresAt?: string | null;
  lockedAt?: string | null;
  processingStartedAt?: string | null;
  lastStage?: string | null;
  errorMessage?: string | null;
  reprocessErrorMessage?: string | null;
  extractionVersion?: string | null;
  analysisVersion?: string | null;
  lastSuccessfulExtractionVersion?: string | null;
  lastSuccessfulAnalysisVersion?: string | null;
};

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(
  status: string | undefined,
  doc?: Pick<UploadedDocumentRecord, "reprocessErrorMessage" | "lastStage">,
): string {
  if (
    status === "PROCESSED" &&
    (doc?.reprocessErrorMessage || doc?.lastStage === "reprocess_failed")
  ) {
    return "text-amber-300";
  }
  switch (status) {
    case "QUEUED":
    case "STALE":
    case "PROCESSING":
    case "EXTRACTED":
    case "ANALYZING":
    case "DELETING":
    case "OCR_REQUIRED":
      return "text-amber-300";
    case "PROCESSED":
      return "text-emerald-300";
    case "FAILED":
      return "text-red-300";
    case "UPLOADED":
      return "text-zinc-400";
    default:
      return "text-zinc-500";
  }
}

function analysisLabel(doc: {
  status?: string;
  lastStage?: string | null;
  reprocessErrorMessage?: string | null;
}): string {
  return progressLabelForStatus(doc.status ?? "", {
    lastStage: doc.lastStage,
    reprocessErrorMessage: doc.reprocessErrorMessage,
  });
}

function actionsForDocument(doc: UploadedDocumentRecord): ManualUploadRowAction[] {
  return visibleManualUploadActions({
    status: doc.status,
    updated_at: doc.updatedAt ?? doc.createdAt,
    lease_expires_at: doc.leaseExpiresAt ?? null,
    locked_at: doc.lockedAt ?? null,
    processing_started_at: doc.processingStartedAt ?? null,
  });
}

function isDocRemovalBlocked(doc: UploadedDocumentRecord): boolean {
  return isRemovalBlocked({
    status: doc.status,
    lease_expires_at: doc.leaseExpiresAt ?? null,
    locked_at: doc.lockedAt ?? null,
    processing_started_at: doc.processingStartedAt ?? null,
  });
}

function logStatusTransition(fields: {
  documentId?: string | null;
  uploadId?: string | null;
  analysisJobId?: string | null;
  status?: string | null;
  previousStatus?: string | null;
  source: string;
}): void {
  console.info(
    JSON.stringify({
      event: "upload_ui_status_transition",
      ts: new Date().toISOString(),
      document_id: fields.documentId ?? null,
      upload_id: fields.uploadId ?? null,
      analysis_job_id: fields.analysisJobId ?? null,
      status: fields.status ?? null,
      previous_status: fields.previousStatus ?? null,
      source: fields.source,
    }),
  );
}

async function uploadFileWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`Storage upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export function DocumentUploadPanel({
  initialDocuments = [],
}: {
  initialDocuments?: UploadedDocumentRecord[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusLogRef = useRef<Map<string, string>>(new Map());
  const [dragOver, setDragOver] = useState(false);
  // Ephemeral upload progress only — never the analysis status of record.
  // Empty on every page load (no localStorage hydration).
  const [session, setSession] = useState<SessionUploadEntry[]>([]);
  const [recent, setRecent] =
    useState<UploadedDocumentRecord[]>(initialDocuments);
  const [listError, setListError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<
    string | null
  >(null);
  const [removingDocumentId, setRemovingDocumentId] = useState<string | null>(
    null,
  );
  const [cancellingDocumentId, setCancellingDocumentId] = useState<
    string | null
  >(null);
  const [upgradePending, setUpgradePending] = useState(false);
  const [retryPending, setRetryPending] = useState(false);

  const docMap = useMemo(() => documentsById(recent), [recent]);

  const busy = session.some(
    (i) =>
      i.phase === "signing" ||
      i.phase === "uploading" ||
      i.phase === "enqueueing",
  );

  // Clear any legacy session keys from older builds. Session React state
  // starts empty on every mount (no localStorage hydration).
  useEffect(() => {
    clearStaleUploadSessionStorage(
      typeof window !== "undefined" ? window.localStorage : null,
    );
    clearStaleUploadSessionStorage(
      typeof window !== "undefined" ? window.sessionStorage : null,
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Log status transitions from the authoritative list (shared by both sections).
  useEffect(() => {
    for (const doc of recent) {
      const prev = statusLogRef.current.get(doc.id);
      if (prev === doc.status) continue;
      statusLogRef.current.set(doc.id, doc.status);
      logStatusTransition({
        documentId: doc.id,
        uploadId: doc.id,
        analysisJobId: doc.id,
        status: doc.status,
        previousStatus: prev ?? null,
        source: "authoritative_documents_list",
      });
    }
  }, [recent]);

  const applyAuthoritativeDocuments = useCallback(
    (documents: UploadedDocumentRecord[]) => {
      setRecent(documents);
      setSession((prev) => pruneSessionEntries(prev, documents));
    },
    [],
  );

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = (await res.json()) as {
        documents?: UploadedDocumentRecord[];
        error?: string;
      };
      if (!res.ok) {
        setListError(data.error ?? "Could not load uploads.");
        return;
      }
      applyAuthoritativeDocuments(data.documents ?? []);
      setListError(null);
    } catch {
      setListError("Could not load uploads.");
    }
  }, [applyAuthoritativeDocuments]);

  // Poll by document_id until authoritative status is current/failed.
  useEffect(() => {
    const shouldPoll = shouldPollDocumentIds({
      sessionDocumentIds: session.map((s) => s.documentId),
      documents: recent,
    });
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      void refreshList();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [session, recent, refreshList]);

  const retryProcessing = useCallback(
    async (documentIds?: string[]) => {
      const singleId = documentIds?.length === 1 ? documentIds[0]! : null;

      if (singleId) {
        const fromRecent = recent.find((d) => d.id === singleId);
        const status = fromRecent?.status;
        if (shouldSkipReprocess(status)) {
          setToast({
            tone: "success",
            message: "Processing already in progress for this document.",
          });
          await refreshList();
          return;
        }
        if (reprocessingDocumentId === singleId) return;
        setReprocessingDocumentId(singleId);
      } else {
        setRetryPending(true);
      }
      setListError(null);
      try {
        const res = await fetch("/api/documents/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(documentIds?.length ? { documentIds } : {}),
        });
        const data = (await res.json()) as {
          error?: string;
          requeued?: string[];
        };
        if (!res.ok) {
          setListError(data.error ?? "Retry failed.");
          return;
        }
        if (singleId && (data.requeued?.length ?? 0) === 0) {
          setToast({
            tone: "success",
            message: "Processing already in progress for this document.",
          });
        }
        for (const id of data.requeued ?? []) {
          logStatusTransition({
            documentId: id,
            uploadId: id,
            analysisJobId: id,
            status: "QUEUED",
            source: "reprocess_request",
          });
        }
        await refreshList();
      } catch {
        setListError("Retry failed.");
      } finally {
        setRetryPending(false);
        setReprocessingDocumentId(null);
      }
    },
    [refreshList, recent, reprocessingDocumentId],
  );

  const upgradeOutdatedDocuments = useCallback(async () => {
    setUpgradePending(true);
    setListError(null);
    try {
      const res = await fetch("/api/documents/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        error?: string;
        enqueued?: string[];
        markedStale?: string[];
      };
      if (!res.ok) {
        setListError(data.error ?? "Upgrade failed.");
        return;
      }
      const count = data.enqueued?.length ?? 0;
      setToast({
        tone: "success",
        message:
          count > 0
            ? `Reprocessing ${count} outdated document${count === 1 ? "" : "s"}.`
            : "No outdated documents to reprocess.",
      });
      await refreshList();
    } catch {
      setListError("Upgrade failed.");
    } finally {
      setUpgradePending(false);
    }
  }, [refreshList]);

  const removeDocument = useCallback(
    async (doc: UploadedDocumentRecord) => {
      if (!window.confirm(removeConfirmMessage(doc.status))) return;
      setRemovingDocumentId(doc.id);
      setListError(null);
      setRecent((prev) => prev.filter((row) => row.id !== doc.id));
      setSession((prev) => prev.filter((row) => row.documentId !== doc.id));
      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as {
          error?: string;
          cleanupRequired?: boolean;
          orphanedStoragePath?: string | null;
        };
        if (res.status === 404) {
          setToast({ tone: "success", message: "File removed." });
          return;
        }
        if (!res.ok && res.status !== 207) {
          setRecent((prev) =>
            prev.some((row) => row.id === doc.id) ? prev : [doc, ...prev],
          );
          const message =
            res.status === 409 && data.error === "Processing in progress"
              ? PROCESSING_IN_PROGRESS_LABEL
              : data.error ?? "Remove failed.";
          setToast({ tone: "error", message });
          setListError(message);
          return;
        }
        if (data.cleanupRequired || data.orphanedStoragePath) {
          const repair = await fetch(`/api/documents/${doc.id}?repair=1`, {
            method: "DELETE",
          });
          if (repair.status === 404) {
            setToast({ tone: "success", message: "File removed." });
            return;
          }
          if (!repair.ok && repair.status !== 207) {
            setRecent((prev) =>
              prev.some((row) => row.id === doc.id) ? prev : [doc, ...prev],
            );
            let repairMessage =
              "File partially removed. Retry Remove to finish cleanup.";
            try {
              const repairBody = (await repair.json()) as { error?: string };
              if (repairBody.error) repairMessage = repairBody.error;
            } catch {
              /* keep default */
            }
            setToast({ tone: "error", message: repairMessage });
            setListError(repairMessage);
            return;
          }
        }
        setToast({
          tone: "success",
          message:
            doc.status === "PROCESSED" || doc.status === "DELETING"
              ? "File removed and company analysis rebuilt."
              : "File removed.",
        });
      } catch {
        setRecent((prev) =>
          prev.some((row) => row.id === doc.id) ? prev : [doc, ...prev],
        );
        setToast({ tone: "error", message: "Remove failed." });
        setListError("Remove failed.");
      } finally {
        setRemovingDocumentId(null);
      }
    },
    [],
  );

  const cancelProcessing = useCallback(
    async (documentId: string) => {
      setCancellingDocumentId(documentId);
      setListError(null);
      try {
        const res = await fetch(`/api/documents/${documentId}/cancel`, {
          method: "POST",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setListError(data.error ?? "Cancel failed.");
          return;
        }
        await refreshList();
      } catch {
        setListError("Cancel failed.");
      } finally {
        setCancellingDocumentId(null);
      }
    },
    [refreshList],
  );

  const processFile = useCallback(
    async (file: File, localId: string) => {
      const patch = (partial: Partial<SessionUploadEntry>) => {
        setSession((prev) =>
          prev.map((item) =>
            item.localId === localId ? { ...item, ...partial } : item,
          ),
        );
      };

      try {
        patch({ phase: "signing", progress: 0, error: undefined });
        const initRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            byteSize: file.size,
          }),
        });
        const initData = (await initRes.json()) as {
          documentId?: string;
          signedUrl?: string;
          error?: string;
        };
        if (!initRes.ok || !initData.documentId || !initData.signedUrl) {
          throw new Error(initData.error ?? "Could not start upload.");
        }

        const documentId = initData.documentId;
        logStatusTransition({
          documentId,
          uploadId: documentId,
          analysisJobId: documentId,
          status: "UPLOADED",
          source: "upload_signed",
        });

        // Bind immutable document_id immediately — never use filename as identity.
        patch({
          phase: "uploading",
          documentId,
          progress: 0,
        });
        await uploadFileWithProgress(initData.signedUrl, file, (pct) => {
          patch({ progress: pct });
        });

        patch({ phase: "enqueueing", progress: 100 });
        const completeRes = await fetch("/api/documents/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });
        const completeData = (await completeRes.json()) as {
          status?: string;
          document?: UploadedDocumentRecord;
          kickoff?: { status?: string; documentId?: string };
          error?: string;
        };
        if (!completeRes.ok) {
          throw new Error(completeData.error ?? "Could not enqueue document.");
        }

        const kickoffStatus =
          completeData.document?.status ??
          completeData.kickoff?.status ??
          completeData.status ??
          "QUEUED";

        logStatusTransition({
          documentId,
          uploadId: documentId,
          analysisJobId: documentId,
          status: kickoffStatus,
          source: "upload_complete_kickoff",
        });

        // Replace temporary upload state with the persisted document record.
        // Analysis label comes only from `recent` after refresh — not from kickoff.
        patch({
          phase: "done",
          documentId,
          progress: 100,
        });

        if (completeData.document?.id) {
          setRecent((prev) => {
            const without = prev.filter((d) => d.id !== completeData.document!.id);
            return [
              {
                ...completeData.document!,
                status: kickoffStatus,
              },
              ...without,
            ];
          });
        }

        await refreshList();
      } catch (err) {
        patch({
          phase: "error",
          error: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    },
    [refreshList],
  );

  const filesByLocalId = useRef(new Map<string, File>());

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const next: SessionUploadEntry[] = list.map((file) => {
        const localId = crypto.randomUUID();
        filesByLocalId.current.set(localId, file);
        return {
          localId,
          documentId: null,
          filename: file.name,
          byteSize: file.size,
          progress: 0,
          phase: "queued" as const,
        };
      });

      setSession((prev) => [...next, ...prev]);
      for (const item of next) {
        const file = filesByLocalId.current.get(item.localId);
        if (!file) continue;
        if (item.byteSize > MAX_UPLOAD_BYTES) {
          setSession((prev) =>
            prev.map((row) =>
              row.localId === item.localId
                ? {
                    ...row,
                    phase: "error",
                    error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
                  }
                : row,
            ),
          );
          filesByLocalId.current.delete(item.localId);
          continue;
        }
        void processFile(file, item.localId).finally(() => {
          filesByLocalId.current.delete(item.localId);
        });
      }
    },
    [processFile],
  );

  // Visible session rows: in-progress uploads + in-flight analysis only.
  // Status ALWAYS from authoritative recent map by document_id.
  const visibleSession = session.filter((entry) => {
    if (entry.phase === "error") return true;
    if (entry.phase !== "done") return true;
    if (!entry.documentId) return true;
    const doc = docMap.get(entry.documentId);
    if (!doc) return false;
    return isInFlightUploadStatus(doc.status);
  });

  return (
    <div className="space-y-6">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          enqueueFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed px-6 py-12 text-center transition ${
          dragOver
            ? "border-indigo-400/60 bg-indigo-500/10"
            : "border-[var(--border)] bg-white/[0.02]"
        }`}
      >
        <p className="text-sm font-medium text-zinc-200">
          Drag and drop documents here
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {MANUAL_UPLOAD_FORMAT_LABELS.join(" · ")} · up to{" "}
          {Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB each
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MANUAL_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {visibleSession.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-200">This session</h3>
          <ul className="space-y-2">
            {visibleSession.map((item) => {
              const authDoc = resolveSessionDocument(item, docMap);
              const status = authDoc?.status;
              return (
                <li
                  key={item.documentId ?? item.localId}
                  className="rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">
                        {item.filename}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatBytes(item.byteSize)}
                        {item.phase === "uploading"
                          ? ` · uploading ${item.progress}%`
                          : item.phase === "signing"
                            ? " · preparing upload"
                            : item.phase === "enqueueing"
                              ? " · finishing upload"
                              : item.phase === "done" && status
                                ? ` · analysis: ${analysisLabel({
                                    status,
                                    lastStage: authDoc?.lastStage,
                                    reprocessErrorMessage:
                                      authDoc?.reprocessErrorMessage,
                                  })}`
                                : item.phase === "error"
                                  ? ""
                                  : " · waiting"}
                      </p>
                      {item.error ? (
                        <p className="mt-1 text-xs text-red-400">{item.error}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        {item.phase === "done" ? "Upload complete" : item.phase}
                      </div>
                      {item.phase === "done" && status ? (
                        <div
                          className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${statusTone(status, authDoc ?? undefined)}`}
                        >
                          {analysisLabel({
                            status,
                            lastStage: authDoc?.lastStage,
                            reprocessErrorMessage:
                              authDoc?.reprocessErrorMessage,
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {(item.phase === "uploading" ||
                    item.phase === "enqueueing" ||
                    item.phase === "done") && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-indigo-400/80 transition-[width]"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-200">Recent uploads</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={upgradePending || retryPending}
              onClick={() => void upgradeOutdatedDocuments()}
              className="text-xs font-medium text-sky-300 transition hover:text-sky-200 disabled:opacity-60"
            >
              {upgradePending
                ? "Enqueueing…"
                : "Reprocess outdated documents"}
            </button>
            {recent.some(
              (d) =>
                d.status === "QUEUED" ||
                d.status === "FAILED" ||
                d.status === "STALE" ||
                d.status === "OCR_REQUIRED",
            ) ? (
              <button
                type="button"
                disabled={retryPending}
                onClick={() => void retryProcessing()}
                className="text-xs font-medium text-amber-300 transition hover:text-amber-200 disabled:opacity-60"
              >
                {retryPending ? "Retrying…" : "Retry Processing"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void refreshList()}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Refresh
            </button>
          </div>
        </div>
        {toast ? (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-sm ${
              toast.tone === "success"
                ? "bg-emerald-950/50 text-emerald-300"
                : "bg-red-950/40 text-red-300"
            }`}
          >
            {toast.message}
          </p>
        ) : null}
        {listError ? (
          <p className="text-sm text-red-400">{listError}</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No documents yet. Upload files to start your first analysis.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {recent.map((doc) => {
              const actions = actionsForDocument(doc);
              const reprocessing = reprocessingDocumentId === doc.id;
              const removing = removingDocumentId === doc.id;
              const cancelling = cancellingDocumentId === doc.id;
              const blocked = isDocRemovalBlocked(doc);
              const rowBusy = reprocessing || removing || cancelling;
              const inFlight = shouldSkipReprocess(doc.status);
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">
                      {doc.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {doc.byteSize != null ? formatBytes(doc.byteSize) : "—"}
                      {doc.mimeType ? ` · ${doc.mimeType}` : ""}
                      {" · analysis: "}
                      <span className={statusTone(doc.status, doc)}>
                        {analysisLabel(doc)}
                      </span>
                    </p>
                    {(doc.errorMessage || doc.reprocessErrorMessage) && (
                      <p className="mt-1 max-w-xl text-[11px] leading-snug text-red-300/90">
                        {doc.reprocessErrorMessage ?? doc.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {actions.includes("retry") ? (
                      <button
                        type="button"
                        disabled={
                          reprocessing || removing || cancelling || inFlight
                        }
                        onClick={() => void retryProcessing([doc.id])}
                        className={`text-xs font-medium text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed ${
                          reprocessing ? "opacity-60" : "disabled:opacity-100"
                        }`}
                      >
                        {reprocessing
                          ? "Reprocessing…"
                          : inFlight
                            ? "Processing…"
                            : doc.status === "PROCESSED"
                              ? "Reprocess"
                              : "Retry"}
                      </button>
                    ) : null}
                    {actions.includes("cancel") ? (
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void cancelProcessing(doc.id)}
                        className={`text-xs font-medium text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed ${
                          cancelling ? "opacity-60" : "disabled:opacity-100"
                        }`}
                      >
                        {cancelling ? "Cancelling…" : "Cancel"}
                      </button>
                    ) : null}
                    {actions.includes("remove") ? (
                      <button
                        type="button"
                        disabled={removing || reprocessing || cancelling}
                        onClick={() => void removeDocument(doc)}
                        className={`text-xs font-medium text-red-300 transition hover:text-red-200 disabled:cursor-not-allowed ${
                          removing ? "opacity-60" : "disabled:opacity-100"
                        }`}
                      >
                        {removing ? "Deleting…" : "Remove"}
                      </button>
                    ) : blocked ? (
                      <span
                        className="text-xs text-zinc-500"
                        title={PROCESSING_IN_PROGRESS_LABEL}
                      >
                        {PROCESSING_IN_PROGRESS_LABEL}
                      </span>
                    ) : null}
                    <span
                      className={`text-[11px] font-medium uppercase tracking-wide ${statusTone(doc.status, doc)}`}
                    >
                      {analysisLabel(doc)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
