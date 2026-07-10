import { formatEvidenceLabel } from "@/lib/domain";
import type { Finding, Recommendation, Risk } from "@/lib/domain";
import type { RawEvidence, RecommendationGenerationRule, RiskAssessmentRule } from "../types";

/**
 * Stage 3: Findings → Recommendations
 * Generates actionable next steps with supporting evidence and impact estimates.
 */
export function generateRecommendations(
  findings: Finding[],
  _evidence: RawEvidence[],
  rules: RecommendationGenerationRule[],
): Recommendation[] {
  const findingMap = new Map(findings.map((f) => [f.id, f]));

  return rules
    .filter((rule) => rule.findingIds.every((id) => findingMap.has(id)))
    .map((rule) => {
      const supportingEvidenceIds = [
        ...new Set(
          rule.findingIds.flatMap((id) => findingMap.get(id)?.evidenceIds ?? []),
        ),
      ];

      return {
        ...rule.recommendation,
        findingIds: rule.findingIds,
        supportingEvidenceIds,
      };
    });
}

/**
 * Stage 4: Findings → Risks
 * Materializes threats from findings and links to recommendations.
 */
export function assessRisks(
  findings: Finding[],
  evidence: RawEvidence[],
  _recommendations: Recommendation[],
  rules: RiskAssessmentRule[],
): Risk[] {
  const findingMap = new Map(findings.map((f) => [f.id, f]));
  const evidenceMap = new Map(evidence.map((e) => [e.id, e]));

  return rules
    .filter((rule) => rule.findingIds.every((id) => findingMap.has(id)))
    .map((rule) => {
      const evidenceIds = [
        ...new Set(
          rule.findingIds.flatMap((id) => findingMap.get(id)?.evidenceIds ?? []),
        ),
      ];
      const primaryEvidence = evidenceIds[0]
        ? evidenceMap.get(evidenceIds[0])
        : undefined;

      return {
        ...rule.risk,
        findingIds: rule.findingIds,
        evidenceIds,
        recommendationId: rule.recommendationId,
        recommendation: rule.risk.recommendation,
        primaryEvidenceLabel: primaryEvidence
          ? formatEvidenceLabel(primaryEvidence)
          : rule.risk.primaryEvidenceLabel,
      };
    });
}
