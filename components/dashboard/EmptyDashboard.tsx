"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UploadProgressItem } from "@/lib/uploads/progress";
import type { UploadProgressLabel } from "@/lib/uploads/constants";

export function EmptyDashboard({
  companyName,
  analyzing = false,
  hasUploads = false,
  stalled = false,
  progressItems = [],
  overallLabel = "Idle",
}: {
  companyName?: string;
  analyzing?: boolean;
  hasUploads?: boolean;
  stalled?: boolean;
  progressItems?: UploadProgressItem[];
  overallLabel?: UploadProgressLabel | "Idle";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);

  async function onRetry() {
    setRetryError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/documents/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setRetryError(data.error ?? "Retry failed");
          return;
        }
        router.refresh();
      } catch {
        setRetryError("Retry failed");
      }
    });
  }

  const showProcessing = analyzing || (hasUploads && progressItems.length > 0);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-indigo-300">
        {stalled
          ? "Stalled"
          : showProcessing
            ? overallLabel === "Idle"
              ? "Processing"
              : overallLabel
            : hasUploads
              ? "Awaiting analysis"
              : "Upload required"}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {stalled
          ? "Processing appears stalled"
          : showProcessing
            ? "Building your first health snapshot"
            : hasUploads
              ? "Documents are queued for analysis"
              : companyName
                ? `Upload documents for ${companyName}`
                : "Upload documents to begin"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        {stalled
          ? "No progress for 5 minutes. Retry processing to re-queue failed or stuck uploads."
          : showProcessing
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
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
            >
              <span className="truncate text-zinc-300">{item.filename}</span>
              <span
                className={
                  item.label === "Failed"
                    ? "shrink-0 text-red-300"
                    : item.label === "Complete"
                      ? "shrink-0 text-emerald-300"
                      : "shrink-0 text-amber-300"
                }
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {retryError ? (
        <p className="mt-4 text-sm text-red-300">{retryError}</p>
      ) : null}

      {stalled ||
      progressItems.some(
        (i) => i.label === "Failed" || i.label === "Queued",
      ) ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={pending}
          className="mt-8 rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
        >
          {pending ? "Retrying…" : "Retry Processing"}
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
