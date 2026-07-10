interface ActionCardProps {
  title: string;
  priority: "high" | "medium" | "low";
  dimension: string;
  description: string;
}

const priorityStyles = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-zinc-400 bg-white/[0.04] border-white/10",
};

const priorityLabels = {
  high: "High priority",
  medium: "Medium",
  low: "Low",
};

export function ActionCard({ title, priority, dimension, description }: ActionCardProps) {
  return (
    <div className="group flex gap-3 rounded-md border border-[var(--border)] bg-white/[0.02] p-3.5 transition-colors hover:border-white/12 hover:bg-white/[0.04]">
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.04]">
        <div className="h-2 w-2 rounded-sm border border-zinc-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-medium text-zinc-200">{title}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityStyles[priority]}`}>
            {priorityLabels[priority]}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">{dimension}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  );
}
