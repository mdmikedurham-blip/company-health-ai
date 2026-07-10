import { AppShell } from "@/components/AppShell";
import { TimelineContent } from "@/components/timeline/TimelineContent";
import { scoreChangeExplanation, timelineEvents } from "@/lib/data";

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export default function TimelinePage() {
  const chains = new Set(
    timelineEvents.map((e) => e.causalChainId || e.rootEventId || e.id),
  ).size;

  const changeColor =
    scoreChangeExplanation.change > 0
      ? "text-emerald-400"
      : scoreChangeExplanation.change < 0
        ? "text-red-400"
        : "text-zinc-500";

  return (
    <AppShell
      title="Health Timeline"
      subtitle={`${timelineEvents.length} events · ${chains} causal chains · ${scoreChangeExplanation.period}`}
    >
      <div className="mb-6 panel border-indigo-500/15 bg-indigo-500/5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
          Current period summary
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
          {scoreChangeExplanation.summary}
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums">
            {scoreChangeExplanation.currentScore}
          </span>
          <span className={`text-sm font-medium ${changeColor}`}>
            {formatSigned(scoreChangeExplanation.change)}
          </span>
          <span className="text-xs text-zinc-600">
            from {scoreChangeExplanation.previousScore}
          </span>
        </div>
      </div>
      <TimelineContent events={timelineEvents} />
    </AppShell>
  );
}
