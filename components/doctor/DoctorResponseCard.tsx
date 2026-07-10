import type { DoctorResponse } from "@/lib/types";
import { RiskLevelBadge } from "@/components/RiskLevelBadge";

interface DoctorResponseCardProps {
  response: DoctorResponse;
}

export function DoctorResponseCard({ response }: DoctorResponseCardProps) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Analysis
        </p>
        <RiskLevelBadge level={response.riskLevel} />
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-300">{response.summary}</p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Evidence
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {response.evidenceSources.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {source}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
          Recommended action
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{response.recommendedAction}</p>
      </div>
    </div>
  );
}
