"use client";

import Link from "next/link";
import type { ExplainPayload } from "@/lib/types";

interface ExplainDrawerProps {
  payload: ExplainPayload | null;
  onClose: () => void;
}

export function ExplainDrawer({ payload, onClose }: ExplainDrawerProps) {
  if (!payload) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-labelledby="explain-title"
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
              {payload.type === "risk" ? "Risk Explanation" : "Dimension Explanation"}
            </p>
            <h2 id="explain-title" className="mt-1 text-lg font-semibold tracking-tight text-white">
              {payload.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{payload.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Why this matters
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                {payload.whyItMatters}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Score / risk impact
              </p>
              <p className="mt-2 text-[13px] text-zinc-300">{payload.scoreImpact}</p>
              <div className="mt-3 flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-zinc-600">Confidence</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-400">
                    {payload.confidence}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">Est. improvement</p>
                  <p className="text-lg font-semibold tabular-nums text-indigo-400">
                    +{payload.estimatedScoreImprovement} pts
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Evidence sources
              </p>
              <div className="mt-2 space-y-2">
                {payload.evidenceSources.length > 0 ? (
                  payload.evidenceSources.map((source) => (
                    <Link
                      key={source.id}
                      href="/evidence"
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-md border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 transition-colors hover:border-emerald-500/30"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {source.label}
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-zinc-600">No linked evidence documents yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/80">
                Recommended action
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                {payload.recommendedAction}
              </p>
            </div>
          </section>
        </div>

        <div className="border-t border-[var(--border)] px-5 py-4">
          <div className="flex gap-2">
            <Link
              href={`/doctor?explain=${payload.type === "risk" ? payload.id : ""}`}
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] bg-white/[0.04] px-4 py-2.5 text-center text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
            >
              Ask Company Doctor
            </Link>
            <Link
              href="/timeline"
              onClick={onClose}
              className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-indigo-400"
            >
              View timeline
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
