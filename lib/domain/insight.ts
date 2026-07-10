import type {
  DimensionId,
  EvidenceId,
  FindingId,
  InsightId,
  InsightType,
} from "./primitives";

/**
 * Atomic intelligence statement derived from Evidence.
 * Insights feed Findings; an LLM can generate statements later without UI changes.
 *
 * Pipeline: Evidence → Insight → Finding → Risk / Recommendation
 */
export interface Insight {
  id: InsightId;
  statement: string;
  dimensionId: DimensionId;
  dimension: string;
  evidenceIds: EvidenceId[];
  confidence: number;
  generatedAt: string;
  /** @deprecated Prefer `statement` — kept for UI adapters. */
  title: string;
  /** @deprecated Prefer `statement` — kept for UI adapters. */
  detail: string;
  findingIds: FindingId[];
  type: InsightType;
}
