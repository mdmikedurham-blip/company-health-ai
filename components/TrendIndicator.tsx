import type { TrendDirection } from "@/lib/domain";

interface TrendIndicatorProps {
  trend: TrendDirection;
  value: number;
}

export function TrendIndicator({ trend, value }: TrendIndicatorProps) {
  if (trend === "flat") {
    return (
      <span className="flex w-10 shrink-0 items-center justify-end gap-0.5 text-[11px] text-zinc-500">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M5 12h14" />
        </svg>
        —
      </span>
    );
  }

  const isUp = trend === "up";
  return (
    <span
      className={`flex w-10 shrink-0 items-center justify-end gap-0.5 text-[11px] font-medium tabular-nums ${
        isUp ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={isUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"}
        />
      </svg>
      {value}
    </span>
  );
}
