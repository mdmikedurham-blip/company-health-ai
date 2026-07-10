import type { ScoreChangeExplanation } from "@/lib/domain";

interface ScoreChangeCardProps {
  data: ScoreChangeExplanation;
  onExplain?: () => void;
}

export function ScoreChangeCard({ data, onExplain }: ScoreChangeCardProps) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Why did score change?
        </p>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            className="text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            View timeline →
          </button>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{data.currentScore}</span>
        <span className="text-sm font-medium text-emerald-400">+{data.change}</span>
        <span className="text-xs text-zinc-600">from {data.previousScore} · {data.period}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{data.summary}</p>
      <div className="mt-4 space-y-2">
        {data.drivers.map((driver) => (
          <div key={driver.dimension} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{driver.dimension}</span>
            <span
              className={`font-medium tabular-nums ${
                driver.impact > 0 ? "text-emerald-400" : driver.impact < 0 ? "text-red-400" : "text-zinc-500"
              }`}
            >
              {driver.impact > 0 ? "+" : ""}
              {driver.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
