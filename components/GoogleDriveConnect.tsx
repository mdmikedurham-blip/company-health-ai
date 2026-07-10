"use client";

import { useCallback, useEffect, useState } from "react";

type DriveStatus = {
  status: "pending" | "connected" | "error";
  accountEmail?: string | null;
  lastSyncedAt?: string | null;
  configured?: boolean;
  syncStatus?: "running" | "succeeded" | "failed" | "partial" | null;
  syncError?: string | null;
  documentsAnalyzed?: number | null;
  evidenceCreated?: number | null;
  analysisReady?: boolean;
  error?: string;
};

function formatSynced(iso: string | null | undefined): string {
  if (!iso) return "Never synced";
  try {
    return `Synced ${new Date(iso).toLocaleString()}`;
  } catch {
    return `Synced ${iso}`;
  }
}

function bannerFromOAuthParams(
  gdrive?: string | null,
  reason?: string | null,
): string | null {
  if (gdrive === "connected") {
    return "Google Drive connected. First sync has started.";
  }
  if (gdrive === "error") {
    return reason || "Google Drive connection failed.";
  }
  return null;
}

function statusLabel(status: DriveStatus | null): {
  label: string;
  tone: string;
} {
  if (!status) return { label: "Checking…", tone: "bg-zinc-600" };
  if (status.status === "pending" || status.status === "error") {
    if (status.status === "error") {
      return { label: "Error", tone: "bg-red-400" };
    }
    return { label: "Disconnected", tone: "bg-zinc-600" };
  }
  if (status.syncStatus === "running") {
    return { label: "Syncing", tone: "bg-amber-400 animate-pulse" };
  }
  if (status.syncStatus === "failed") {
    return { label: "Error", tone: "bg-red-400" };
  }
  if (status.analysisReady || status.syncStatus === "succeeded") {
    return { label: "Ready", tone: "bg-emerald-400" };
  }
  return { label: "Connected", tone: "bg-emerald-400" };
}

export function GoogleDriveConnect({
  oauthResult,
  oauthReason,
  compact = false,
  comingSoon = false,
}: {
  oauthResult?: string | null;
  oauthReason?: string | null;
  compact?: boolean;
  comingSoon?: boolean;
}) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [localBanner, setLocalBanner] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (comingSoon) return;
    fetch("/api/connectors/google-drive/status")
      .then(async (r) => {
        const data = (await r.json()) as DriveStatus;
        if (!r.ok) {
          setStatus({ status: "error", error: data.error ?? "Failed to load" });
          return;
        }
        setStatus(data);
      })
      .catch(() => setStatus({ status: "pending", configured: false }));
  }, [comingSoon]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (comingSoon) return;
    if (status?.syncStatus !== "running") return;
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [comingSoon, status?.syncStatus, refresh]);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/connectors/google-drive/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setLocalBanner(data.error ?? "Disconnect failed.");
        return;
      }
      setStatus((prev) => ({
        status: "pending",
        configured: prev?.configured,
        accountEmail: null,
        lastSyncedAt: null,
        syncStatus: null,
        analysisReady: false,
      }));
      setLocalBanner("Google Drive disconnected.");
    } finally {
      setBusy(false);
    }
  }

  if (comingSoon) {
    return (
      <div
        className={
          compact
            ? "rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5"
            : "rounded-xl border border-[var(--border)] bg-white/[0.02] p-5"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-zinc-200">Google Drive</p>
              <span className="rounded-md border border-zinc-600/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Optional connector — not required for onboarding. Upload documents
              to start analysis.
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-zinc-500">
            Unavailable
          </span>
        </div>
      </div>
    );
  }

  const connected = status?.status === "connected";
  const syncing = connected && status?.syncStatus === "running";
  const failed = connected && status?.syncStatus === "failed";
  const { label, tone } = statusLabel(status);
  const banner =
    localBanner ?? bannerFromOAuthParams(oauthResult, oauthReason);

  return (
    <div
      className={
        compact
          ? "rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5"
          : "rounded-xl border border-[var(--border)] bg-white/[0.02] p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-200">Google Drive</p>
              <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                {label}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {connected
                ? status?.accountEmail || "Read-only access"
                : "Connect with drive.readonly + offline access"}
            </p>
            {connected ? (
              <p className="mt-1 text-xs text-zinc-600">
                {syncing
                  ? "First sync in progress…"
                  : formatSynced(status?.lastSyncedAt)}
                {typeof status?.documentsAnalyzed === "number"
                  ? ` · ${status.documentsAnalyzed} docs`
                  : ""}
                {typeof status?.evidenceCreated === "number"
                  ? ` · ${status.evidenceCreated} evidence`
                  : ""}
              </p>
            ) : null}
            {status?.syncError ? (
              <p className="mt-1 text-xs text-red-400">{status.syncError}</p>
            ) : null}
          </div>
        </div>
        {connected ? (
          <div className="flex shrink-0 items-center gap-3">
            {failed ? (
              <a
                href="/api/connectors/google-drive/authorize"
                className="text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
              >
                Retry
              </a>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href="/api/connectors/google-drive/authorize"
            className="shrink-0 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 transition hover:bg-white"
          >
            Connect Google Drive
          </a>
        )}
      </div>
      {banner ? (
        <p className="mt-3 text-xs text-zinc-500">{banner}</p>
      ) : null}
      {syncing && !compact ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-400/70" />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Inventorying Drive files and extracting evidence. This page updates
            automatically.
          </p>
        </div>
      ) : null}
      {label === "Ready" && !compact ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Sync complete. Your private dashboard is ready.
          </p>
          <a
            href="/dashboard"
            className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 transition hover:bg-white"
          >
            Open dashboard
          </a>
        </div>
      ) : null}
    </div>
  );
}
