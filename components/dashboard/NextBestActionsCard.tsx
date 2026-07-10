import type { Recommendation } from "@/lib/domain";

interface NextBestActionsCardProps {
  actions: Recommendation[];
}

const priorityStyles = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-zinc-400",
};

export function NextBestActionsCard({ actions }: NextBestActionsCardProps) {
  return (
    <div className="panel p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        Next best actions
      </p>
      <p className="mt-1 text-xs text-zinc-600">Highest-impact actions by estimated score improvement</p>
      <div className="mt-4 space-y-3">
        {actions.map((action, i) => (
          <div
            key={action.id}
            className="flex gap-3 rounded-md border border-[var(--border)] bg-white/[0.02] p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-zinc-200">{action.title}</p>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-indigo-400">
                  +{action.estimatedHealthImpact}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {action.dimension} ·{" "}
                <span className={priorityStyles[action.priority]}>{action.priority} priority</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{action.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
