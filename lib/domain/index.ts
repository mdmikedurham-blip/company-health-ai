export type {
  ActionPriority,
  BoardPrepStatus,
  CompanyId,
  ConnectorStatus,
  DimensionId,
  EvidenceId,
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
  ScoreChangeDriver,
  ScoreChangeExplanation,
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
export type { Evidence, ConnectorSummary, EvidenceCatalog } from "./evidence";
export { formatEvidenceLabel } from "./evidence";
export type { ExecutiveBrief, BriefWin, BoardPrepItem, BoardMeetingPrep } from "./executive-brief";
export type { Finding } from "./finding";
export type { HealthDimension, HealthDimensionSummary, HealthScore } from "./health";
export { toDimensionSummary } from "./health";
export type { Insight } from "./insight";
export type { Recommendation } from "./recommendation";
export type { Report } from "./report";
export type { Risk, RiskCardView } from "./risk";
export { toRiskCardView } from "./risk";
export type { CompanyHealthSnapshot } from "./snapshot";
export type { TimelineEvent } from "./timeline";

export {
  getDashboardMetrics,
  getDimension,
  getDimensionIdByName,
  getEvidence,
  getEvidenceForDimension,
  getEvidenceForRisk,
  getFinding,
  getFindingsForEvidence,
  getInsight,
  getNextBestActions,
  getRecommendation,
  getRisk,
  getRisksForDimension,
  getTopRisks,
  resolveEvidenceLabels,
} from "./selectors";

export {
  buildDimensionExplainPayload,
  buildRiskExplainPayload,
  getDimensionIdByName as getDimensionIdByNameFromSnapshot,
} from "./explain";
