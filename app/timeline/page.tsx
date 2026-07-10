import { AppShell } from "@/components/AppShell";
import { TimelineContent } from "@/components/timeline/TimelineContent";
import { scoreChangeExplanation, timelineEvents } from "@/lib/data";

export default function TimelinePage() {
  return (
    <AppShell
      title="Health Timeline"
      subtitle={`${timelineEvents.length} events · ${scoreChangeExplanation.period}`}
    >
      <div className="mb-6 panel border-indigo-500/15 bg-indigo-500/5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
          Current period summary
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
          {scoreChangeExplanation.summary}
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums">{scoreChangeExplanation.currentScore}</span>
          <span className="text-sm font-medium text-emerald-400">
            +{scoreChangeExplanation.change}
          </span>
          <span className="text-xs text-zinc-600">from {scoreChangeExplanation.previousScore}</span>
        </div>
      </div>
      <TimelineContent events={timelineEvents} />
    </AppShell>
  );
}
