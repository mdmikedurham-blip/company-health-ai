import type { Finding, Risk } from "@/lib/domain";
import {
  SEVERITY_HIGH_MATERIALITY_MIN,
  SEVERITY_HIGH_SCORE_IMPACT_MAX,
  SEVERITY_MEDIUM_MATERIALITY_MIN,
  SEVERITY_MEDIUM_SCORE_IMPACT_MAX,
  SEVERITY_MULTIPLIER,
} from "@/lib/intelligence/rules";
import type { BusinessMateriality } from "@/lib/domain/executive-brief";

/**
 * Derive business materiality from finding materiality, health impact,
 * evidence support, and linked risk severity.
 *
 * Deterministic — same inputs always yield the same band.
 */
export function deriveBusinessMateriality(params: {
  findingMateriality: number;
  impact: number;
  evidenceCount: number;
  confidence: number;
  riskSeverity?: Risk["severity"];
}): BusinessMateriality {
  const absImpact = Math.abs(params.impact);
  // Finding materiality is 1–10 in policy; treat as score-impact scale for thresholds
  const mat = params.findingMateriality;

  if (
    params.riskSeverity === "high" ||
    mat >= SEVERITY_HIGH_MATERIALITY_MIN ||
    absImpact >= Math.abs(SEVERITY_HIGH_SCORE_IMPACT_MAX) ||
    (absImpact >= 6 && params.evidenceCount >= 3 && params.confidence >= 85)
  ) {
    return "high";
  }

  if (
    params.riskSeverity === "medium" ||
    mat >= SEVERITY_MEDIUM_MATERIALITY_MIN ||
    absImpact >= Math.abs(SEVERITY_MEDIUM_SCORE_IMPACT_MAX) ||
    (absImpact >= 3 && params.evidenceCount >= 2 && params.confidence >= 70)
  ) {
    return "medium";
  }

  return "low";
}

export function materialityMultiplier(level: BusinessMateriality): number {
  return SEVERITY_MULTIPLIER[level];
}

/**
 * Short CEO-facing reason derived from finding + risk context.
 * No hardcoded marketing copy — composed from entity fields.
 */
export function buildDriverReason(params: {
  finding?: Finding;
  risk?: Risk;
  direction: Finding["direction"] | "neutral";
  dimension: string;
  impact: number;
}): string {
  if (params.risk?.whyItMatters) {
    return params.risk.whyItMatters;
  }
  if (params.finding?.description) {
    return params.finding.description;
  }
  const signed =
    params.impact > 0 ? `+${params.impact}` : `${params.impact}`;
  if (params.direction === "positive") {
    return `${params.dimension} improved by ${signed} points this period.`;
  }
  if (params.direction === "negative") {
    return `${params.dimension} declined by ${Math.abs(params.impact)} points this period.`;
  }
  return `${params.dimension} contributed ${signed} to health this period.`;
}

export function resolveDriverTitle(params: {
  finding?: Finding;
  evidenceTitle?: string;
  dimension: string;
}): string {
  if (params.finding?.title) return params.finding.title;
  if (params.evidenceTitle) return params.evidenceTitle;
  return `${params.dimension} score movement`;
}
