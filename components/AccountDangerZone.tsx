"use client";

import { useState, useTransition } from "react";
import {
  deleteAccountAction,
  disconnectDriveAction,
} from "@/lib/auth/actions";

export function AccountDangerZone() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
      <h2 className="text-sm font-medium text-red-300">Account & access</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Disconnect Drive or permanently delete your account and owned company
        data.
      </p>
      {message ? (
        <p className="mt-3 text-xs text-zinc-400">{message}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await disconnectDriveAction();
              setMessage(
                result.ok
                  ? "Google Drive disconnected."
                  : result.error ?? "Disconnect failed.",
              );
            });
          }}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          Disconnect Google Drive
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Delete your account and owned company workspace? This cannot be undone.",
              )
            ) {
              return;
            }
            startTransition(async () => {
              const result = await deleteAccountAction();
              if (!result.ok) {
                setMessage(result.error ?? "Delete failed.");
              }
            });
          }}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
