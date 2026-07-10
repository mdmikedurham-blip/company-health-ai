import type { ExplainPayload } from "@/lib/types";
import type { CompanyHealthSnapshot } from "./snapshot";
import type { HealthDimension } from "./health";
import type { Risk } from "./risk";
import {
  getDimension,
  getRisk,
  resolveEvidenceLabels,
} from "./selectors";

export function buildRiskExplainPayload(
  snapshot: CompanyHealthSnapshot,
  riskId: string,
): ExplainPayload | null {
  const risk = getRisk(snapshot, riskId);
  if (!risk) return null;
  return buildRiskExplainFromEntity(snapshot, risk);
}

export function buildDimensionExplainPayload(
  snapshot: CompanyHealthSnapshot,
  dimensionId: string,
): ExplainPayload | null {
  const dimension = getDimension(snapshot, dimensionId);
  if (!dimension) return null;
  return buildDimensionExplainFromEntity(snapshot, dimension);
}

function buildRiskExplainFromEntity(
  snapshot: CompanyHealthSnapshot,
  risk: Risk,
): ExplainPayload {
  return {
    type: "risk",
    id: risk.id,
    title: risk.title,
    subtitle: `${risk.dimension} · ${risk.severity} severity`,
    whyItMatters: risk.whyItMatters,
    scoreImpact: `Resolving this risk could improve overall health by up to ${risk.estimatedScoreImpact} points.`,
    confidence: risk.confidence,
    evidenceSources: resolveEvidenceLabels(snapshot, risk.evidenceIds),
    recommendedAction: risk.recommendation,
    estimatedScoreImprovement: risk.estimatedScoreImpact,
  };
}

function buildDimensionExplainFromEntity(
  snapshot: CompanyHealthSnapshot,
  dimension: HealthDimension,
): ExplainPayload {
  const { direction, value } = dimension.trend;
  const trendLabel =
    direction === "up"
      ? `+${value} this month`
      : direction === "down"
        ? `-${value} this month`
        : "unchanged";

  return {
    type: "dimension",
    id: dimension.id,
    title: dimension.name,
    subtitle: `Score ${dimension.score} · ${trendLabel} · ${dimension.status}`,
    whyItMatters: dimension.whyItMatters,
    scoreImpact: `Current score: ${dimension.score}/100. Addressing gaps could add up to ${dimension.estimatedScoreImprovement} points.`,
    confidence: dimension.confidence,
    evidenceSources: resolveEvidenceLabels(snapshot, dimension.evidenceIds),
    recommendedAction:
      dimension.recommendedActions[0] ?? "No action required at this time.",
    estimatedScoreImprovement: dimension.estimatedScoreImprovement,
  };
}
