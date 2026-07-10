"use client";

import { useEffect, useState } from "react";

type DriveStatus = {
  status: "pending" | "connected" | "error";
  accountEmail?: string | null;
  lastSyncedAt?: string | null;
  configured?: boolean;
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
    return "Google Drive connected with read-only access.";
  }
  if (gdrive === "error") {
    return reason || "Google Drive connection failed.";
  }
  return null;
}

export function GoogleDriveConnect({
  companyId,
  oauthResult,
  oauthReason,
}: {
  companyId?: string;
  oauthResult?: string | null;
  oauthReason?: string | null;
}) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [localBanner, setLocalBanner] = useState<string | null>(null);

  useEffect(() => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    fetch(`/api/connectors/google-drive/status${qs}`)
      .then((r) => r.json())
      .then((data: DriveStatus) => setStatus(data))
      .catch(() => setStatus({ status: "pending", configured: false }));
  }, [companyId]);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/connectors/google-drive/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      setStatus((prev) => ({
        status: "pending",
        configured: prev?.configured,
        accountEmail: null,
        lastSyncedAt: null,
      }));
      setLocalBanner("Google Drive disconnected.");
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.status === "connected";
  const authorizeHref = companyId
    ? `/api/connectors/google-drive/authorize?companyId=${encodeURIComponent(companyId)}`
    : "/api/connectors/google-drive/authorize";
  const banner =
    localBanner ?? bannerFromOAuthParams(oauthResult, oauthReason);

  return (
    <div className="rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              connected ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm text-zinc-300">Google Drive</p>
            <p className="truncate text-xs text-zinc-600">
              {connected
                ? status?.accountEmail || "Read-only access"
                : "Not connected"}
              {connected && status?.lastSyncedAt
                ? ` · ${formatSynced(status.lastSyncedAt)}`
                : ""}
            </p>
          </div>
        </div>
        {connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="shrink-0 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : (
          <a
            href={authorizeHref}
            className="shrink-0 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 transition hover:bg-white"
          >
            Connect
          </a>
        )}
      </div>
      {banner ? (
        <p className="mt-2 text-xs text-zinc-500">{banner}</p>
      ) : null}
    </div>
  );
}
