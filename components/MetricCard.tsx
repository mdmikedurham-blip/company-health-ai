interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
}

export function MetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {change && (
        <p className="mt-0.5 text-[11px] text-zinc-500">{change}</p>
      )}
    </div>
  );
}
