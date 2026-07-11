import type { ScoreChangeExplanation } from "@/lib/domain";

interface ScoreChangeCardProps {
  data: ScoreChangeExplanation;
  onExplain?: () => void;
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function ScoreChangeCard({ data, onExplain }: ScoreChangeCardProps) {
  const hasPrior = data.hasPriorSnapshot === true;
  const changeColor =
    hasPrior && data.change > 0
      ? "text-emerald-400"
      : hasPrior && data.change < 0
        ? "text-red-400"
        : "text-zinc-500";

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
      {hasPrior ? (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {data.currentScore}
          </span>
          <span className={`text-sm font-medium ${changeColor}`}>
            {formatSigned(data.change)}
          </span>
          <span className="text-xs text-zinc-600">
            from {data.previousScore} · {data.period}
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <span className="text-sm font-medium text-zinc-400">
            No prior assessment to compare
          </span>
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{data.summary}</p>
      {hasPrior && data.drivers.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.drivers.map((driver) => (
            <div
              key={driver.dimension}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-zinc-500">{driver.dimension}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span
                  className={
                    driver.currentScoreImpact > 0
                      ? "text-emerald-400"
                      : driver.currentScoreImpact < 0
                        ? "text-red-400"
                        : "text-zinc-500"
                  }
                  title="Current score impact vs baseline"
                >
                  {formatSigned(driver.currentScoreImpact)}
                </span>
                {driver.periodDelta !== 0 && (
                  <span
                    className="text-zinc-600"
                    title="Period-over-period change"
                  >
                    ({formatSigned(driver.periodDelta)} vs prior)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
