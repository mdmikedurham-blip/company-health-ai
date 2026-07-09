import type { HealthStatus, RiskSeverity } from "@/lib/domain";

export function StatusBadge({ status }: { status: HealthStatus }) {
  const styles: Record<HealthStatus, string> = {
    healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    watch: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    risk: "bg-red-500/10 text-red-400 border-red-500/25",
  };
  const labels: Record<HealthStatus, string> = {
    healthy: "Healthy",
    watch: "Watch",
    risk: "At Risk",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/** Map engine severities to the three-tone badge used in marketing UI. */
function toBadgeLevel(severity: RiskSeverity): "high" | "medium" | "low" {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export function RiskBadge({ severity }: { severity: RiskSeverity }) {
  const level = toBadgeLevel(severity);
  const styles = {
    high: "risk-high",
    medium: "risk-medium",
    low: "risk-low",
  };
  const labels = {
    high: severity === "critical" ? "Critical" : "High",
    medium: "Medium",
    low: "Low",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[level]}`}
    >
      {labels[level]}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: "p0" | "p1" | "p2" | "p3";
}) {
  const styles = {
    p0: "bg-red-500/10 text-red-400 border-red-500/25",
    p1: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    p2: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    p3: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}
