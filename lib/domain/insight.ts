import type {
  DimensionId,
  EvidenceId,
  FindingId,
  InsightId,
  InsightType,
} from "./primitives";

/**
 * Atomic intelligence statement derived from Evidence.
 * UI should display `statement` (title/detail aliases removed).
 */
export interface Insight {
  id: InsightId;
  statement: string;
  dimensionId: DimensionId;
  dimension: string;
  evidenceIds: EvidenceId[];
  confidence: number;
  generatedAt: string;
  /** Stable rule identifier used by finding/risk engines (not display copy). */
  ruleId: string;
  findingIds: FindingId[];
  type: InsightType;
}
