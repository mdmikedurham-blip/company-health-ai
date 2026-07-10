import type { Evidence } from "./evidence";
import { formatEvidenceLabel } from "./evidence";
import type { Finding } from "./finding";
import type { HealthDimension } from "./health";
import type { Insight } from "./insight";
import type { Recommendation } from "./recommendation";
import type { Risk } from "./risk";
import type { CompanyHealthSnapshot } from "./snapshot";

export function getDimension(
  snapshot: CompanyHealthSnapshot,
  id: string,
): HealthDimension | undefined {
  return snapshot.dimensions.find((d) => d.id === id);
}

export function getRisk(snapshot: CompanyHealthSnapshot, id: string): Risk | undefined {
  return snapshot.risks.find((r) => r.id === id);
}

export function getEvidence(snapshot: CompanyHealthSnapshot, id: string): Evidence | undefined {
  return snapshot.evidence.find((e) => e.id === id);
}

export function getFinding(snapshot: CompanyHealthSnapshot, id: string): Finding | undefined {
  return snapshot.findings.find((f) => f.id === id);
}

export function getInsight(snapshot: CompanyHealthSnapshot, id: string): Insight | undefined {
  return snapshot.insights.find((i) => i.id === id);
}

export function getRecommendation(
  snapshot: CompanyHealthSnapshot,
  id: string,
): Recommendation | undefined {
  return snapshot.recommendations.find((r) => r.id === id);
}

export function getEvidenceForDimension(
  snapshot: CompanyHealthSnapshot,
  dimensionId: string,
): Evidence[] {
  return snapshot.evidence.filter(
    (e) => e.dimensionId === dimensionId || e.dimensionIds?.includes(dimensionId),
  );
}

export function getFindingsForEvidence(
  snapshot: CompanyHealthSnapshot,
  evidenceId: string,
): Finding[] {
  return snapshot.findings.filter((f) => f.evidenceIds.includes(evidenceId));
}

export function getEvidenceForRisk(snapshot: CompanyHealthSnapshot, risk: Risk): Evidence[] {
  return risk.evidenceIds
    .map((id) => getEvidence(snapshot, id))
    .filter((e): e is Evidence => e !== undefined);
}

export function getRisksForDimension(
  snapshot: CompanyHealthSnapshot,
  dimensionId: string,
): Risk[] {
  return snapshot.risks.filter((r) => r.dimensionId === dimensionId);
}

export function getTopRisks(snapshot: CompanyHealthSnapshot, limit = 3): Risk[] {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return [...snapshot.risks]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, limit);
}

export function getNextBestActions(
  snapshot: CompanyHealthSnapshot,
  limit = 3,
): Recommendation[] {
  return [...snapshot.recommendations]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

export function resolveEvidenceLabels(
  snapshot: CompanyHealthSnapshot,
  evidenceIds: string[],
): { id: string; label: string; system: string }[] {
  return evidenceIds.map((id) => {
    const item = getEvidence(snapshot, id);
    return {
      id,
      label: item ? formatEvidenceLabel(item) : id,
      system: item?.sourceSystem ?? "Unknown",
    };
  });
}

export function getDimensionIdByName(
  snapshot: CompanyHealthSnapshot,
  name: string,
): string | undefined {
  return snapshot.dimensions.find((d) => d.name === name)?.id;
}

export function getDashboardMetrics(snapshot: CompanyHealthSnapshot) {
  const highPriorityActions = snapshot.recommendations.filter(
    (r) => r.priority === "high",
  ).length;
  const highRisks = snapshot.risks.filter((r) => r.severity === "high").length;
  const evidenceCount = snapshot.evidence.length;
  const catalogDocs = snapshot.evidenceCatalog.totalDocuments;

  return [
    {
      label: "Documents analyzed",
      value: catalogDocs.toLocaleString(),
      change: `${evidenceCount} in current assessment`,
    },
    {
      label: "Active risks",
      value: String(snapshot.risks.length),
      change:
        highRisks > 0
          ? `${highRisks} high severity`
          : snapshot.risks.length === 0
            ? "None open"
            : "No high severity",
    },
    {
      label: "Open actions",
      value: String(snapshot.recommendations.length),
      change:
        highPriorityActions > 0
          ? `${highPriorityActions} high priority`
          : snapshot.recommendations.length === 0
            ? "None open"
            : "Prioritized by engine",
    },
    {
      label: "Confidence score",
      value: `${snapshot.healthScore.confidence}%`,
      change:
        snapshot.healthScore.confidence >= 85
          ? "High reliability"
          : snapshot.healthScore.confidence >= 60
            ? "Moderate reliability"
            : "Low — add evidence",
    },
  ];
}
