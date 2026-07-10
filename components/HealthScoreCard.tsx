interface HealthScoreCardProps {
  score: number;
  status: "healthy" | "watch" | "at-risk";
  change: number;
  changeLabel: string;
  lastUpdated: string;
  confidence?: number;
}

const statusConfig = {
  healthy: { label: "Healthy", className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  watch: { label: "Watch", className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  "at-risk": { label: "At Risk", className: "text-red-400 bg-red-500/10 border-red-500/20" },
};

export function HealthScoreCard({
  score,
  status,
  change,
  changeLabel,
  lastUpdated,
  confidence,
}: HealthScoreCardProps) {
  const config = statusConfig[status];
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="panel flex flex-col justify-between p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Overall Company Health
          </p>
          <p className="mt-1 text-xs text-zinc-600">{lastUpdated}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
            {config.label}
          </span>
          {confidence !== undefined && (
            <span className="text-[11px] text-zinc-500">
              <span className="font-medium text-emerald-400">{confidence}%</span> confidence
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6">
        <div className="relative shrink-0">
          <svg viewBox="0 0 128 128" className="h-28 w-28 -rotate-90">
            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              stroke="url(#healthGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{score}</span>
            <span className="text-[10px] text-zinc-500">/ 100</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="text-lg font-semibold text-emerald-400">+{change}</span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">{changeLabel}</p>
          <p className="mt-3 max-w-[200px] text-xs leading-relaxed text-zinc-500">
            Score improved across Financial and People dimensions this month.
          </p>
        </div>
      </div>
    </div>
  );
}
