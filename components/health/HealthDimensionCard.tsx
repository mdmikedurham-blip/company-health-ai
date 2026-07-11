"use client";

import type { HealthDimension } from "@/lib/domain";
import { useExplain } from "@/components/explain/ExplainProvider";
import { TrendIndicator } from "@/components/TrendIndicator";

interface HealthDimensionCardProps {
  dimension: HealthDimension;
}

const statusStyles: Record<string, string> = {
  healthy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  watch: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "at-risk": "text-red-400 bg-red-500/10 border-red-500/20",
  insufficient: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export function HealthDimensionCard({ dimension }: HealthDimensionCardProps) {
  const { openDimension } = useExplain();
  const scored =
    dimension.scored !== false && dimension.status !== "insufficient";
  const statusClass =
    statusStyles[dimension.status] ?? statusStyles.insufficient;

  return (
    <button
      type="button"
      onClick={() => openDimension(dimension.id)}
      className="panel group w-full p-5 text-left transition-colors hover:border-indigo-500/30 hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white">
            {dimension.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">{dimension.owner}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusClass}`}
        >
          {scored ? dimension.status : "insufficient"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          {scored ? (
            <>
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {dimension.score}
              </span>
              <TrendIndicator
                trend={dimension.trend.direction}
                value={dimension.trend.value}
              />
            </>
          ) : (
            <span className="text-lg font-semibold text-zinc-400">
              Not enough evidence
            </span>
          )}
        </div>
        {scored && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-600">
              <span className="font-medium text-emerald-400">
                {dimension.confidence}%
              </span>{" "}
              confidence
            </p>
            <p className="text-[11px] text-zinc-600">
              {dimension.evidenceCount} evidence
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        {scored && (
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
            style={{ width: `${dimension.score}%` }}
          />
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {scored ? dimension.summary : "Not enough evidence"}
      </p>

      {scored && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {dimension.topDrivers.map((driver) => (
            <span
              key={driver}
              className="rounded-md border border-[var(--border)] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400"
            >
              {driver}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] font-medium text-indigo-400/80 opacity-0 transition-opacity group-hover:opacity-100">
        Click to explain →
      </p>
    </button>
  );
}
