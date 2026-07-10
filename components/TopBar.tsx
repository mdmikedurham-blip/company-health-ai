"use client";

import { company } from "@/lib/data";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function TopBar({ title, subtitle, onMenuClick }: TopBarProps) {
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
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/15 hover:text-zinc-200 sm:flex"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          Search
          <kbd className="ml-2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          className="relative rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a2 2 0 10-4 0v1.083A6 6 0 004 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
        </button>

        <div className="hidden h-5 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-zinc-300">Sarah Chen</p>
            <p className="text-[10px] text-zinc-500">{company.name} · CEO</p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
            SC
          </div>
        </div>
      </div>
    </header>
  );
}
