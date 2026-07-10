"use client";

import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  userName?: string | null;
  companyName?: string | null;
  userEmail?: string | null;
  demoMode?: boolean;
}

function initials(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function TopBar({
  title,
  subtitle,
  onMenuClick,
  userName,
  companyName,
  userEmail,
  demoMode = false,
}: TopBarProps) {
  const displayName = userName || userEmail || "Account";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-zinc-500">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {demoMode ? (
          <Link
            href="/signup"
            className="hidden rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 sm:inline-flex"
          >
            Create account
          </Link>
        ) : (
          <form action={signOutAction}>
            <button
              type="submit"
              className="hidden rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 sm:inline-flex"
            >
              Sign out
            </button>
          </form>
        )}

        <div className="hidden h-5 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-zinc-300">{displayName}</p>
            <p className="text-[10px] text-zinc-500">
              {companyName || "Workspace"}
              {demoMode ? " · demo" : ""}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
            {initials(userName, userEmail)}
          </div>
        </div>
      </div>
    </header>
  );
}
