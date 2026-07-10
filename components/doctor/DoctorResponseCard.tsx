"use client";

import Link from "next/link";
import type { DoctorAnswer } from "@/lib/doctor/types";
import { RiskLevelBadge } from "@/components/RiskLevelBadge";

interface DoctorResponseCardProps {
  response: DoctorAnswer;
}

export function DoctorResponseCard({ response }: DoctorResponseCardProps) {
  const primaryAction = response.recommendedActions[0];

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Analysis
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">
            {response.confidence}% confidence
          </span>
          <RiskLevelBadge level={response.riskLevel} />
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-zinc-300">{response.answer}</p>

      {response.summary && response.summary !== response.answer && (
        <p className="text-xs leading-relaxed text-zinc-500">{response.summary}</p>
      )}

      {response.insufficientEvidence && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
            Insufficient evidence
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            This answer is limited by available evidence in the current snapshot.
          </p>
        </div>
      )}

      {response.evidenceCitations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Evidence
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {response.evidenceCitations.map((source) => (
              <Link
                key={source.id}
                href={source.href}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {source.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {response.relevantRisks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Relevant risks
          </p>
          <ul className="mt-1.5 space-y-1">
            {response.relevantRisks.map((risk) => (
              <li key={risk.id} className="text-xs text-zinc-400">
                {risk.title}{" "}
                <span className="text-zinc-600">({risk.severity})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {primaryAction && (
        <div className="rounded-md border border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
            Recommended action
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {primaryAction.title}
            {response.recommendedActions.length > 1
              ? `; ${response.recommendedActions
                  .slice(1)
                  .map((a) => a.title)
                  .join("; ")}`
              : ""}
          </p>
        </div>
      )}

      {response.limitations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Limitations
          </p>
          <ul className="mt-1 space-y-0.5">
            {response.limitations.map((limitation) => (
              <li key={limitation} className="text-[11px] text-zinc-600">
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
