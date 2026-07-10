import type { RiskSeverity } from "@/lib/domain";

const levelStyles: Record<RiskSeverity, string> = {
  high: "risk-high",
  medium: "risk-medium",
  low: "risk-low",
};

const levelLabels: Record<RiskSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface RiskLevelBadgeProps {
  level: RiskSeverity;
  className?: string;
}

export function RiskLevelBadge({ level, className = "" }: RiskLevelBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${levelStyles[level]} ${className}`}
    >
      {levelLabels[level]}
    </span>
  );
}
