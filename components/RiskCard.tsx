"use client";

import type { RiskSeverity } from "@/lib/domain";
import { useExplainOptional } from "@/components/explain/ExplainProvider";
import { RiskLevelBadge } from "./RiskLevelBadge";

interface RiskCardProps {
  title: string;
  level: RiskSeverity;
  dimension: string;
  summary: string;
  source: string;
  rank?: number;
  riskId?: string;
}

export function RiskCard({
  title,
  level,
  dimension,
  summary,
  source,
  rank,
  riskId,
}: RiskCardProps) {
  const explain = useExplainOptional();

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {rank !== undefined && (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] text-[10px] font-semibold text-zinc-400">
              {rank}
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">{dimension}</p>
          </div>
        </div>
        <RiskLevelBadge level={level} />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">{summary}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-indigo-400/70" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {source}
        </p>
        {riskId && explain && (
          <button
            type="button"
            onClick={() => explain.openRisk(riskId)}
            className="shrink-0 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/15"
          >
            Explain
          </button>
        )}
      </div>
    </div>
  );
}
