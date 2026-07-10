import type {
  DimensionId,
  EvidenceId,
  FindingId,
} from "./primitives";

/**
 * A structured observation extracted from one or more Evidence records.
 * Findings sit between raw Evidence and synthesized Insights/Risks.
 *
 * Pipeline: Evidence → Finding → Insight / Risk
 */
export interface Finding {
  id: FindingId;
  title: string;
  summary: string;
  evidenceIds: EvidenceId[];
  dimensionId: DimensionId;
  dimension: string;
  confidence: number;
  extractedAt: string;
  sourceSystem: string;
}
