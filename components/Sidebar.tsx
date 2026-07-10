"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomNavItems, mainNavItems } from "@/lib/navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 ring-1 ring-indigo-500/25">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Company Health AI</p>
          <p className="truncate text-[11px] text-zinc-500">Acme Corp</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Overview
        </p>
        {mainNavItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-white/[0.06] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              <span className={isActive ? "text-indigo-400" : "text-zinc-500"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] px-3 py-3">
        {bottomNavItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <span className="text-zinc-500">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div className="mt-3 rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[11px] font-medium text-zinc-400">Executive plan</p>
          <p className="mt-0.5 text-xs text-zinc-500">5 systems connected</p>
        </div>
      </div>
    </aside>
  );
}
