"use client";

import { useState } from "react";

const exportActions = [
  { id: "pdf", label: "Download PDF", icon: "M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { id: "board", label: "Send to board", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "memo", label: "Generate investor memo", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

export function ExportActions() {
  const [activeExport, setActiveExport] = useState<string | null>(null);

  return (
    <div className="panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        Export
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {exportActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              setActiveExport(action.id);
              setTimeout(() => setActiveExport(null), 2500);
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              activeExport === action.id
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-[var(--border)] bg-white/[0.03] text-zinc-300 hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
            </svg>
            {activeExport === action.id ? "Preparing..." : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
