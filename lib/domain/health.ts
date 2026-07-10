import type {
  DimensionId,
  EvidenceId,
  FindingId,
  HealthStatus,
  Trend,
} from "./primitives";

/**
 * Overall company health score — aggregate of all dimension scores.
 * Baseline from config; engine enriches links from pipeline output.
 */
export interface HealthScore {
  score: number;
  status: HealthStatus;
  change: number;
  changeLabel: string;
  lastUpdated: string;
  confidence: number;
}

export interface HealthDimension {
  id: DimensionId;
  name: string;
  score: number;
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
}

/** Lightweight projection for dashboard rows and lists. */
export interface HealthDimensionSummary {
  id: DimensionId;
  name: string;
  score: number;
  status: HealthStatus;
  trend: Trend["direction"];
  trendValue: Trend["value"];
}

export function toDimensionSummary(dimension: HealthDimension): HealthDimensionSummary {
  return {
    id: dimension.id,
    name: dimension.name,
    score: dimension.score,
    status: dimension.status,
    trend: dimension.trend.direction,
    trendValue: dimension.trend.value,
  };
}
