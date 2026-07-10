import type {
  DimensionId,
  EvidenceId,
  FindingDirection,
  FindingId,
  InsightId,
} from "./primitives";

/**
 * A structured observation derived from Insights and Evidence.
 * Findings sit between Insights and Risks / scoring.
 *
 * Pipeline: Evidence → Insight → Finding → Risk
 */
export interface Finding {
  id: FindingId;
  title: string;
  description: string;
  dimensionId: DimensionId;
  dimension: string;
  insightIds: InsightId[];
  evidenceIds: EvidenceId[];
  direction: FindingDirection;
  materiality: number;
  confidence: number;
  /** Score delta applied by the scoring engine (−N … +N). */
  scoreImpact: number;
  /** @deprecated Prefer `description` — kept for UI adapters. */
  summary: string;
  extractedAt: string;
  sourceSystem: string;
}
