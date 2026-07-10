import type { Insight } from "@/lib/domain";

interface AIInsightsPanelProps {
  insights: Insight[];
}

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            AI Insights
          </p>
        </div>
        <span className="text-[10px] text-zinc-600">Live</span>
      </div>
      <div className="mt-3 space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-md border border-[var(--border)] bg-white/[0.02] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-zinc-200">{insight.title}</p>
              <span className="shrink-0 text-[10px] text-zinc-600">{insight.generatedAt}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{insight.detail}</p>
            <span className="mt-2 inline-block text-[10px] font-medium text-indigo-400/80">
              {insight.dimension}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
