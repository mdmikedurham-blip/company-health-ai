import type {
  DimensionId,
  EvidenceId,
  FindingId,
  RecommendationId,
  RiskId,
  RiskSeverity,
  RiskStatus,
} from "./primitives";

export interface Risk {
  id: RiskId;
  title: string;
  summary: string;
  dimensionId: DimensionId;
  dimension: string;
  severity: RiskSeverity;
  likelihood: number;
  impact: number;
  findingIds: FindingId[];
  evidenceIds: EvidenceId[];
  confidence: number;
  status: RiskStatus;
  estimatedScoreImpact: number;
  /** Narrative for explain drawer / doctor — derived from findings. */
  whyItMatters: string;
  recommendationId: RecommendationId;
  recommendation: string;
  primaryEvidenceLabel: string;
  explainPrompt: string;
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
