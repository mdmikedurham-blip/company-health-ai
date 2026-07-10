"use client";

import type { TimelineEvent, TimelineEventType } from "@/lib/domain";

const eventTypeStyles: Record<TimelineEventType, { color: string; label: string }> = {
  "score-change": { color: "bg-indigo-500", label: "Score change" },
  "evidence-added": { color: "bg-emerald-500", label: "Evidence" },
  "finding-created": { color: "bg-sky-500", label: "Finding" },
  "risk-created": { color: "bg-red-500", label: "Risk created" },
  "risk-resolved": { color: "bg-emerald-500", label: "Risk resolved" },
  board: { color: "bg-violet-500", label: "Board" },
  legal: { color: "bg-amber-500", label: "Legal" },
  customer: { color: "bg-blue-500", label: "Customer" },
  financial: { color: "bg-teal-500", label: "Financial" },
};

interface TimelineContentProps {
  events: TimelineEvent[];
}

export function TimelineContent({ events }: TimelineContentProps) {
  const months = [...new Set(events.map((e) => e.month))];

  return (
    <div className="space-y-8">
      {months.map((month) => {
        const monthEvents = events.filter((e) => e.month === month);
        return (
          <section key={month}>
            <h2 className="mb-4 text-sm font-semibold text-zinc-400">{month}</h2>
            <div className="relative space-y-0">
              <div className="absolute bottom-0 left-[7px] top-2 w-px bg-white/[0.08]" />
              {monthEvents.map((event) => {
                const style = eventTypeStyles[event.type];
                return (
                  <div key={event.id} className="relative flex gap-4 pb-6 pl-0">
                    <div className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-[var(--background)] ${style.color}`} />
                    <div className="panel min-w-0 flex-1 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                              {style.label}
                            </span>
                            {event.dimension && (
                              <span className="text-[10px] text-zinc-600">{event.dimension}</span>
                            )}
                          </div>
                          <h3 className="mt-1.5 text-sm font-semibold text-zinc-100">{event.title}</h3>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-zinc-600">{event.date}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{event.description}</p>
                      {event.scoreBefore !== undefined && event.scoreAfter !== undefined && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Score: {event.scoreBefore} → {event.scoreAfter}
                        </p>
                      )}
                      {event.whyHealthChanged && (
                        <div className="mt-3 rounded-md border border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
                            Why did health change?
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                            {event.whyHealthChanged}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
