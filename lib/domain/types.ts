/**
 * Domain type barrel — Phase 2 public surface for intelligence + UI.
 * Prefer importing from `@/lib/domain` or `@/lib/domain/types`.
 */
export type {
  ActionPriority,
  BoardPrepStatus,
  CompanyId,
  ConnectorStatus,
  DimensionId,
  EffortLevel,
  EvidenceId,
  FindingDirection,
  FindingId,
  HealthStatus,
  InsightId,
  InsightType,
  RecommendationId,
  ReportId,
  ReportStatus,
  ReportType,
  RiskId,
  RiskSeverity,
  RiskStatus,
  ScoreChangeDriver,
  ScoreChangeExplanation,
  ScoreImpactExplanation,
  TimelineEventId,
  TimelineEventType,
  Trend,
  TrendDirection,
} from "./primitives";

export type { Company } from "./company";
export type {
  CompanyDNA,
  BoardMember,
  ConnectedSystem,
  CompanyProduct,
  KeyMetric,
  UpcomingDate,
} from "./company-dna";
export {
  DIMENSION_IDS,
  DIMENSION_NAMES,
  dimensionIdFromName,
  dimensionName,
  type KnownDimensionId,
} from "./dimensions";
export type {
  Evidence,
  ConnectorSummary,
  EvidenceCatalog,
  EvidenceCitation,
  ExtractedFacts,
} from "./evidence";
export type {
  ExecutiveBrief,
  BriefSeed,
  BriefPreviousSlice,
  BriefScoreChange,
  BriefRiskItem,
  BriefActionItem,
  BriefBoardImplication,
  CausalDriver,
  BusinessMateriality,
  DimensionScoreDelta,
  ScoreDeltaResult,
} from "./executive-brief";
export type { Finding } from "./finding";
export type { HealthDimension, HealthDimensionSummary, HealthScore } from "./health";
export type { Insight } from "./insight";
export type { Recommendation } from "./recommendation";
export type { Report } from "./report";
export type { Risk, RiskCardView } from "./risk";
export type { CompanyHealthSnapshot } from "./snapshot";
export type { TimelineEvent } from "./timeline";

