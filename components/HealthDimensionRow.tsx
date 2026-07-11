"use client";

import type { HealthStatus, TrendDirection } from "@/lib/domain";
import { useExplainOptional } from "@/components/explain/ExplainProvider";
import { TrendIndicator } from "./TrendIndicator";

interface HealthDimensionRowProps {
  name: string;
  score: number;
  status: HealthStatus;
  scored?: boolean;
  trend?: TrendDirection;
  trendValue?: number;
  dimensionId?: string;
}

const statusConfig: Record<
  HealthStatus,
  { label: string; barColor: string; badge: string }
> = {
  healthy: {
    label: "Healthy",
    barColor: "bg-emerald-500",
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  watch: {
    label: "Watch",
    barColor: "bg-amber-500",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  "at-risk": {
    label: "At Risk",
    barColor: "bg-red-500",
    badge: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  insufficient: {
    label: "Insufficient",
    barColor: "bg-zinc-600",
    badge: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  },
};

export function HealthDimensionRow({
  name,
  score,
  status,
  scored = status !== "insufficient",
  trend,
  trendValue = 0,
  dimensionId,
}: HealthDimensionRowProps) {
  const config = statusConfig[status] ?? statusConfig.insufficient;
  const explain = useExplainOptional();
  const isClickable = dimensionId && explain && scored;
  const showScore = scored && status !== "insufficient";

  const content = (
    <>
      <span className="w-28 shrink-0 text-[13px] text-zinc-400 sm:w-32">
        {name}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        {showScore && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${config.barColor}`}
            style={{ width: `${score}%` }}
          />
        )}
      </div>
      <span className="w-16 shrink-0 text-right text-[13px] font-medium tabular-nums text-zinc-300">
        {showScore ? score : "—"}
      </span>
      {showScore && trend && (
        <TrendIndicator trend={trend} value={trendValue} />
      )}
      <span
        className={`hidden w-20 shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-medium lg:inline-block ${config.badge}`}
      >
        {showScore ? config.label : "No evidence"}
      </span>
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => explain.openDimension(dimensionId)}
        className="flex w-full items-center gap-3 rounded-md py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        {content}
      </button>
    );
  }

  return <div className="flex items-center gap-3 py-2">{content}</div>;
}
