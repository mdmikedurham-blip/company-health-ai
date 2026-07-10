"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TimelineEvent, TimelineEventType } from "@/lib/domain";

const eventTypeStyles: Record<
  TimelineEventType,
  { color: string; label: string }
> = {
  "document-added": { color: "bg-zinc-400", label: "Document added" },
  "document-updated": { color: "bg-zinc-500", label: "Document updated" },
  "evidence-created": { color: "bg-emerald-500", label: "Evidence created" },
  "finding-created": { color: "bg-sky-500", label: "Finding created" },
  "finding-updated": { color: "bg-sky-400", label: "Finding updated" },
  "risk-created": { color: "bg-red-500", label: "Risk created" },
  "risk-updated": { color: "bg-orange-500", label: "Risk updated" },
  "risk-resolved": { color: "bg-emerald-500", label: "Risk resolved" },
  "dimension-score-changed": {
    color: "bg-indigo-400",
    label: "Dimension score",
  },
  "overall-score-changed": { color: "bg-indigo-500", label: "Health score" },
  "recommendation-created": {
    color: "bg-violet-500",
    label: "Recommendation",
  },
  "recommendation-completed": {
    color: "bg-violet-400",
    label: "Recommendation done",
  },
  // legacy
  "score-change": { color: "bg-indigo-500", label: "Score change" },
  "evidence-added": { color: "bg-emerald-500", label: "Evidence" },
  board: { color: "bg-violet-500", label: "Board" },
  legal: { color: "bg-amber-500", label: "Legal" },
  customer: { color: "bg-blue-500", label: "Customer" },
  financial: { color: "bg-teal-500", label: "Financial" },
};

const FILTER_TYPES: TimelineEventType[] = [
  "document-added",
  "evidence-created",
  "finding-created",
  "finding-updated",
  "risk-created",
  "risk-updated",
  "risk-resolved",
  "dimension-score-changed",
  "overall-score-changed",
];

interface TimelineContentProps {
  events: TimelineEvent[];
}

export function TimelineContent({ events }: TimelineContentProps) {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");

  const dimensions = useMemo(
    () =>
      [...new Set(events.map((e) => e.dimension).filter(Boolean) as string[])].sort(),
    [events],
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (dimensionFilter !== "all" && e.dimension !== dimensionFilter) {
        return false;
      }
      return true;
    });
  }, [events, typeFilter, dimensionFilter]);

  const byChain = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of filtered) {
      const key = event.causalChainId || event.rootEventId || event.id;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const t = a.occurredAt.localeCompare(b.occurredAt);
        if (t !== 0) return t;
        return a.id.localeCompare(b.id);
      });
    }
    return [...map.entries()].sort((a, b) => {
      const aRoot = a[1][a[1].length - 1];
      const bRoot = b[1][b[1].length - 1];
      return (bRoot?.occurredAt ?? "").localeCompare(aRoot?.occurredAt ?? "");
    });
  }, [filtered]);

  function toggleChain(chainId: string) {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Type
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-white/[0.03] px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="all">All types</option>
            {FILTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {eventTypeStyles[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Dimension
          <select
            value={dimensionFilter}
            onChange={(e) => setDimensionFilter(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-white/[0.03] px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="all">All dimensions</option>
            {dimensions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-4">
        {byChain.map(([chainId, chainEvents]) => {
          const tip = chainEvents[chainEvents.length - 1]!;
          const root = chainEvents.find((e) => e.id === tip.rootEventId) ?? chainEvents[0]!;
          const expanded = expandedChains.has(chainId) || chainEvents.length === 1;
          const style = eventTypeStyles[tip.type];

          return (
            <div key={chainId} className="panel overflow-hidden">
              <button
                type="button"
                onClick={() => toggleChain(chainId)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div
                  className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${style.color}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {style.label}
                    </span>
                    {tip.dimension && (
                      <span className="text-[10px] text-zinc-600">
                        {tip.dimension}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600">
                      {chainEvents.length} event
                      {chainEvents.length === 1 ? "" : "s"} in chain
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-zinc-100">
                    {tip.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {tip.summary || tip.description}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-600">
                  {tip.date}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    Causal chain · What caused this?
                  </p>
                  <div className="relative space-y-0 pl-1">
                    <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/[0.08]" />
                    {chainEvents.map((event) => {
                      const s = eventTypeStyles[event.type];
                      const before =
                        event.previousValue ?? event.scoreBefore;
                      const after = event.currentValue ?? event.scoreAfter;
                      return (
                        <div
                          key={event.id}
                          className="relative flex gap-3 pb-4"
                        >
                          <div
                            className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-[var(--background)] ${s.color}`}
                          />
                          <div className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white/[0.02] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-500">
                                {s.label}
                              </span>
                              {event.dimension && (
                                <span className="text-[10px] text-zinc-600">
                                  {event.dimension}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-medium text-zinc-200">
                              {event.title}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                              {event.summary || event.description}
                            </p>
                            {(before !== undefined || after !== undefined) && (
                              <p className="mt-2 text-xs text-zinc-500">
                                {before !== undefined && after !== undefined
                                  ? `${before} → ${after}`
                                  : after !== undefined
                                    ? `Value: ${after}`
                                    : `Prior: ${before}`}
                                {event.scoreDelta !== undefined && (
                                  <span
                                    className={
                                      event.scoreDelta > 0
                                        ? " text-emerald-400"
                                        : event.scoreDelta < 0
                                          ? " text-red-400"
                                          : ""
                                    }
                                  >
                                    {" "}
                                    ({event.scoreDelta > 0 ? "+" : ""}
                                    {event.scoreDelta})
                                  </span>
                                )}
                              </p>
                            )}
                            {event.evidenceIds.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {event.evidenceIds.map((eid) => (
                                  <Link
                                    key={eid}
                                    href={`/evidence?id=${encodeURIComponent(eid)}`}
                                    className="rounded border border-indigo-500/20 bg-indigo-500/5 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 hover:border-indigo-500/40"
                                  >
                                    {eid}
                                  </Link>
                                ))}
                              </div>
                            )}
                            {event.metadata?.incompleteProvenance === true && (
                              <p className="mt-2 text-[10px] text-amber-400/80">
                                Incomplete provenance
                              </p>
                            )}
                            {event.id === root.id &&
                              event.whyHealthChanged && (
                                <div className="mt-2 rounded-md border border-indigo-500/15 bg-indigo-500/5 px-2.5 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
                                    Why did health change?
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    {event.whyHealthChanged}
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {byChain.length === 0 && (
          <p className="text-sm text-zinc-500">No timeline events match filters.</p>
        )}
      </div>
    </div>
  );
}
