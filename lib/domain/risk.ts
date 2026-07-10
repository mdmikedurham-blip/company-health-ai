import type {
  DimensionId,
  EvidenceId,
  FindingId,
  RecommendationId,
  RiskId,
  RiskSeverity,
} from "./primitives";

export interface Risk {
  id: RiskId;
  title: string;
  severity: RiskSeverity;
  dimensionId: DimensionId;
  dimension: string;
  summary: string;
  whyItMatters: string;
  evidenceIds: EvidenceId[];
  findingIds: FindingId[];
  recommendationId: RecommendationId;
  recommendation: string;
  estimatedScoreImpact: number;
  primaryEvidenceLabel: string;
  explainPrompt: string;
  confidence: number;
}

/** Legacy card view — maps domain `severity` to UI `level`. */
export interface RiskCardView {
  id: RiskId;
  title: string;
  level: RiskSeverity;
  dimension: string;
  summary: string;
  source: string;
  explainPrompt: string;
}

export function toRiskCardView(risk: Risk): RiskCardView {
  return {
    id: risk.id,
    title: risk.title,
    level: risk.severity,
    dimension: risk.dimension,
    summary: risk.summary,
    source: risk.primaryEvidenceLabel,
    explainPrompt: risk.explainPrompt,
  };
}
