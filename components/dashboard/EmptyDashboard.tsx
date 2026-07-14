"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UploadProgressItem } from "@/lib/uploads/progress";
import type { UploadProgressLabel } from "@/lib/uploads/constants";

export function EmptyDashboard({
  companyName,
  analyzing = false,
  hasUploads = false,
  stalled: _stalled = false,
  progressItems = [],
  overallLabel = "Idle",
}: {
  companyName?: string;
  analyzing?: boolean;
  hasUploads?: boolean;
  /** Ignored — generic stalled banner removed; per-step waiting reasons are shown. */
  stalled?: boolean;
  progressItems?: UploadProgressItem[];
  overallLabel?: UploadProgressLabel | string | "Idle";
}) {
  void _stalled;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function onRetry(documentIds?: string[]) {
    setRetryError(null);
    if (documentIds?.length === 1) setRetryingId(documentIds[0]!);
    startTransition(async () => {
      try {
        const res = await fetch("/api/documents/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(documentIds?.length ? { documentIds } : {}),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setRetryError(data.error ?? "Retry failed");
          return;
        }
        router.refresh();
      } catch {
        setRetryError("Retry failed");
      } finally {
        setRetryingId(null);
      }
    });
  }

  const showProcessing = analyzing || (hasUploads && progressItems.length > 0);
  const failedRetryable = progressItems.filter(
    (i) => i.status === "FAILED" && i.retryable,
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-indigo-300">
        {showProcessing
          ? overallLabel === "Idle"
            ? "Processing"
            : overallLabel
          : hasUploads
            ? "Awaiting analysis"
            : "Upload required"}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {showProcessing
          ? "Building your first health snapshot"
          : hasUploads
            ? "Documents are queued for analysis"
            : companyName
              ? `Upload documents for ${companyName}`
              : "Upload documents to begin"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        {showProcessing
          ? "Your workspace is private. Scores and evidence appear here when analysis completes — no demo data is mixed in."
          : hasUploads
            ? "Uploaded files are stored privately. Your dashboard stays empty until analysis finishes."
            : "Manual upload is the primary way to add source files. Google Drive sync is optional and coming soon."}
      </p>

      {progressItems.length > 0 ? (
        <ul className="mt-8 w-full space-y-2 text-left">
          {progressItems.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-zinc-300">{item.filename}</span>
                <span
                  className={
                    item.status === "FAILED"
                      ? "shrink-0 text-red-300"
                      : item.status === "PROCESSED"
                        ? "shrink-0 text-emerald-300"
                        : "shrink-0 text-amber-300"
                  }
                >
                  {item.label}
                </span>
              </div>
              {item.status === "FAILED" ? (
                <div className="mt-1 space-y-1 text-[11px] text-red-300/90">
                  {item.failedStep ? (
                    <p>Failed step: {item.failedStep.replace(/_/g, " ")}</p>
                  ) : null}
                  {item.errorCategory ? (
                    <p>Category: {item.errorCategory}</p>
                  ) : null}
                  {item.errorMessage ? <p>{item.errorMessage}</p> : null}
                  {item.retryable ? (
                    <button
                      type="button"
                      disabled={pending && retryingId === item.id}
                      onClick={() => void onRetry([item.id])}
                      className="font-medium text-amber-200 underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {retryingId === item.id
                        ? "Retrying step…"
                        : "Retry failed step"}
                    </button>
                  ) : (
                    <p>Not retryable — re-upload required.</p>
                  )}
                </div>
              ) : item.waitingReason ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  {item.waitingReason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {retryError ? (
        <p className="mt-4 text-sm text-red-300">{retryError}</p>
      ) : null}

      {failedRetryable.length > 1 ||
      progressItems.some((i) => i.status === "QUEUED") ? (
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={pending}
          className="mt-8 rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
        >
          {pending ? "Retrying…" : "Retry failed steps"}
        </button>
      ) : !showProcessing ? (
        <a
          href="/upload"
          className="mt-8 rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Upload Documents
        </a>
      ) : (
        <a
          href="/upload"
          className="mt-8 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          View uploads →
        </a>
      )}
    </div>
  );
}
