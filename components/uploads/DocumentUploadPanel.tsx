"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  MANUAL_UPLOAD_ACCEPT,
  MANUAL_UPLOAD_FORMAT_LABELS,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads/constants";

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
};

type UploadItem = {
  localId: string;
  file: File;
  progress: number;
  phase: "queued" | "signing" | "uploading" | "enqueueing" | "done" | "error";
  error?: string;
  documentId?: string;
  status?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: string | undefined): string {
  switch (status) {
    case "QUEUED":
      return "text-amber-300";
    case "PROCESSING":
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
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [recent, setRecent] =
    useState<UploadedDocumentRecord[]>(initialDocuments);
  const [listError, setListError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const busy = items.some(
    (i) =>
      i.phase === "signing" ||
      i.phase === "uploading" ||
      i.phase === "enqueueing",
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
      startTransition(() => {
        setRecent(data.documents ?? []);
        setListError(null);
      });
    } catch {
      setListError("Could not load uploads.");
    }
  }, []);

  const processFile = useCallback(
    async (file: File, localId: string) => {
      const patch = (partial: Partial<UploadItem>) => {
        setItems((prev) =>
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

        patch({
          phase: "uploading",
          documentId: initData.documentId,
          progress: 0,
        });
        await uploadFileWithProgress(initData.signedUrl, file, (pct) => {
          patch({ progress: pct });
        });

        patch({ phase: "enqueueing", progress: 100 });
        const completeRes = await fetch("/api/documents/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: initData.documentId }),
        });
        const completeData = (await completeRes.json()) as {
          status?: string;
          error?: string;
        };
        if (!completeRes.ok) {
          throw new Error(completeData.error ?? "Could not enqueue document.");
        }

        patch({
          phase: "done",
          status: completeData.status ?? "QUEUED",
          progress: 100,
        });
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

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const next: UploadItem[] = list.map((file) => ({
        localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        phase: "queued" as const,
      }));

      setItems((prev) => [...next, ...prev]);
      for (const item of next) {
        if (item.file.size > MAX_UPLOAD_BYTES) {
          setItems((prev) =>
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
          continue;
        }
        void processFile(item.file, item.localId);
      }
    },
    [processFile],
  );

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

      {items.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-200">This session</h3>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.localId}
                className="rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">
                      {item.file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatBytes(item.file.size)}
                      {item.status ? ` · ${item.status}` : ""}
                      {item.phase === "uploading"
                        ? ` · ${item.progress}%`
                        : item.phase === "signing"
                          ? " · preparing"
                          : item.phase === "enqueueing"
                            ? " · queueing"
                            : item.phase === "done"
                              ? " · queued for analysis"
                              : ""}
                    </p>
                    {item.error ? (
                      <p className="mt-1 text-xs text-red-400">{item.error}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">
                    {item.phase}
                  </span>
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
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-200">Recent uploads</h3>
          <button
            type="button"
            onClick={() => void refreshList()}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            Refresh
          </button>
        </div>
        {listError ? (
          <p className="text-sm text-red-400">{listError}</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No documents yet. Upload files to start your first analysis.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {recent.map((doc) => (
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
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-medium uppercase tracking-wide ${statusTone(doc.status)}`}
                >
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
