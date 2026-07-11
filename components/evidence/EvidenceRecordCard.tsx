"use client";

import { useState } from "react";
import type { EvidenceExplorerRecord } from "@/lib/application/evidence-explorer-model";

interface EvidenceRecordCardProps {
  record: EvidenceExplorerRecord;
  selected?: boolean;
  onSelect?: () => void;
}

const systemColors: Record<string, string> = {
  HubSpot: "#FF7A59",
  Box: "#0061D5",
  Carta: "#5B4FCF",
  QuickBooks: "#2CA01C",
  "Google Drive": "#4285F4",
  "Manual Upload": "#6366f1",
};

export function EvidenceRecordCard({
  record,
  selected,
  onSelect,
}: EvidenceRecordCardProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const color = systemColors[record.sourceSystem] ?? "#3b82f6";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected
          ? "border-blue-500/40 bg-blue-500/10"
          : "border-[var(--border)] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {record.sourceSystem.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200">
                {record.documentName}
              </p>
              <p className="text-[11px] text-zinc-500">
                {record.documentType} · {record.sourceSystem}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-emerald-400">
              {record.confidence}%
            </p>
            <p className="text-[10px] text-zinc-600">confidence</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-zinc-300">
          {record.aiSummary}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {record.dimensions.map((dim) => (
            <span
              key={dim}
              className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
            >
              {dim}
            </span>
          ))}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-2 py-1.5">
            <dt className="text-zinc-500">Findings</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-yellow-300">
              {record.findingsCreated.length}
            </dd>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5">
            <dt className="text-zinc-500">Risks</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-red-300">
              {record.risksCreated.length}
            </dd>
          </div>
          <div className="rounded-md border border-orange-500/20 bg-orange-500/5 px-2 py-1.5">
            <dt className="text-zinc-500">Actions</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-orange-300">
              {record.recommendationsCreated.length}
            </dd>
          </div>
        </dl>

        {(record.findingsCreated.length > 0 ||
          record.risksCreated.length > 0) && (
          <div className="mt-2 space-y-1">
            {record.findingsCreated.slice(0, 2).map((title) => (
              <p key={title} className="truncate text-[10px] text-yellow-400/90">
                Finding · {title}
              </p>
            ))}
            {record.risksCreated.slice(0, 2).map((title) => (
              <p key={title} className="truncate text-[10px] text-red-400/90">
                Risk · {title}
              </p>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-zinc-600">
          Processed {record.processingDate}
        </p>
      </button>

      <div className="border-t border-white/[0.04] px-4 py-2">
        <button
          type="button"
          onClick={() => setRawOpen((v) => !v)}
          className="text-[10px] font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          {rawOpen ? "Hide raw extract" : "Raw extract (developer)"}
        </button>
        {rawOpen ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-black/40 p-2 text-[10px] leading-relaxed whitespace-pre-wrap text-zinc-500">
            {record.rawExtract}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
