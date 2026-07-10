/** Shared primitive types used across the company health domain. */

export type HealthStatus = "healthy" | "watch" | "at-risk";

export type RiskSeverity = "high" | "medium" | "low";

export type TrendDirection = "up" | "down" | "flat";

export type ActionPriority = "high" | "medium" | "low";

export type InsightType = "alert" | "positive" | "neutral";

export type FindingDirection = "positive" | "negative" | "neutral";

export type RiskStatus = "open" | "monitoring" | "resolved" | "accepted";

export type EffortLevel = "low" | "medium" | "high";

export type ConnectorStatus = "connected" | "pending";

export type ReportType = "board" | "investor" | "internal";

export type ReportStatus = "ready" | "draft" | "scheduled";

export type BoardPrepStatus = "ready" | "needs-attention" | "pending";

export type TimelineEventType =
  | "score-change"
  | "evidence-added"
  | "finding-created"
  | "risk-created"
  | "risk-resolved"
  | "board"
  | "legal"
  | "customer"
  | "financial";

/** Branded ID aliases — strings at runtime, document intent in the type system. */
export type CompanyId = string;
export type DimensionId = string;
export type RiskId = string;
export type EvidenceId = string;
export type FindingId = string;
export type InsightId = string;
export type RecommendationId = string;
export type TimelineEventId = string;
export type ReportId = string;

export interface Trend {
  direction: TrendDirection;
  value: number;
}

export interface ScoreChangeDriver {
  dimension: string;
  impact: number;
  reason: string;
  findingIds?: FindingId[];
  evidenceIds?: EvidenceId[];
}

export interface ScoreChangeExplanation {
  previousScore: number;
  currentScore: number;
  change: number;
  period: string;
  summary: string;
  drivers: ScoreChangeDriver[];
}

/** Per-dimension score audit trail produced by the scoring engine. */
export interface ScoreImpactExplanation {
  dimensionId: DimensionId;
  baselineScore: number;
  finalScore: number;
  impacts: {
    findingId: FindingId;
    impact: number;
    reason: string;
    evidenceIds: EvidenceId[];
  }[];
}
