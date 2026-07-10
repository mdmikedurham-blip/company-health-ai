import type {
  DimensionId,
  FindingId,
  InsightId,
  InsightType,
} from "./primitives";

/**
 * Executive-facing intelligence synthesized from Findings.
 * Insights surface on the dashboard and inform Recommendations.
 *
 * Pipeline: Evidence → Finding → Insight → Recommendation
 */
export interface Insight {
  id: InsightId;
  title: string;
  detail: string;
  dimensionId: DimensionId;
  dimension: string;
  findingIds: FindingId[];
  confidence: number;
  generatedAt: string;
  type: InsightType;
}
