import type {
  ActionPriority,
  DimensionId,
  EffortLevel,
  EvidenceId,
  FindingId,
  RecommendationId,
  RiskId,
} from "./primitives";

/**
 * An actionable next step derived from Risks and Findings.
 * Ranked by priorityScore from the recommendation engine.
 */
export interface Recommendation {
  id: RecommendationId;
  title: string;
  description: string;
  dimensionId: DimensionId;
  dimension: string;
  riskIds: RiskId[];
  evidenceIds: EvidenceId[];
  priority: ActionPriority;
  effort: EffortLevel;
  confidence: number;
  estimatedScoreImprovement: number;
  rationale: string;
  nextSteps: string[];
  /** Ranking score used for ordering (higher = more urgent). */
  priorityScore: number;
  findingIds: FindingId[];
  /** Phase 5 explainability links. */
  questionIds?: string[];
  conceptIds?: string[];
  missingEvidence?: string[];
}
