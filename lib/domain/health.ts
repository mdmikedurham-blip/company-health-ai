import type {
  DimensionId,
  EvidenceId,
  FindingId,
  HealthStatus,
  ScoreImpactExplanation,
  Trend,
} from "./primitives";

/**
 * Overall company health score — aggregate of weighted dimension scores.
 * Produced by the scoring engine from findings; never invented without evidence.
 */
export interface HealthScore {
  score: number;
  /** False when no dimension met the scoring threshold — do not present score as real. */
  scoreAvailable?: boolean;
  status: HealthStatus;
  change: number;
  changeLabel: string;
  lastUpdated: string;
  confidence: number;
  /** Per-dimension audit of how findings moved scores from baseline. */
  scoreExplanations?: ScoreImpactExplanation[];
}

export interface HealthDimension {
  id: DimensionId;
  name: string;
  score: number;
  /** False when this dimension lacks findings — UI shows "Not enough evidence". */
  scored?: boolean;
  trend: Trend;
  status: HealthStatus;
  confidence: number;
  evidenceCount: number;
  owner: string;
  summary: string;
  topDrivers: string[];
  evidenceIds: EvidenceId[];
  findingIds: FindingId[];
  recommendedActions: string[];
  whyItMatters: string;
  estimatedScoreImprovement: number;
  /** Dimension weight in overall health (sums to 1.0 across dimensions). */
  weight?: number;
}

/** Lightweight projection for dashboard rows and lists. */
export interface HealthDimensionSummary {
  id: DimensionId;
  name: string;
  score: number;
  scored: boolean;
  status: HealthStatus;
  trend: Trend["direction"];
  trendValue: Trend["value"];
}

export function toDimensionSummary(dimension: HealthDimension): HealthDimensionSummary {
  return {
    id: dimension.id,
    name: dimension.name,
    score: dimension.score,
    scored: dimension.scored !== false && dimension.status !== "insufficient",
    status: dimension.status,
    trend: dimension.trend.direction,
    trendValue: dimension.trend.value,
  };
}
