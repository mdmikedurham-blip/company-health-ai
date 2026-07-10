import type { RiskLevel } from "@/lib/types";

const levelStyles: Record<RiskLevel, string> = {
  high: "risk-high",
  medium: "risk-medium",
  low: "risk-low",
};

const levelLabels: Record<RiskLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface RiskLevelBadgeProps {
  level: RiskLevel;
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
