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
  CompanyClassification,
  CompanyLifecycleStage,
  ConfirmedClassificationOverrides,
  ClassificationCoverageReport,
  ExpectationItem,
} from "./company-classification";
export {
  COMPANY_LIFECYCLE_STAGES,
} from "./company-classification";
export type {
  EvidenceCoverageReport,
  EvidenceCoverageCategoryStatus,
  EvidenceCoverageItemStatus,
  EvidenceCoverageCategoryId,
  EvidenceCoverageItemId,
} from "./evidence-coverage";
export type {
  AssessmentGoalId,
  AssessmentGoalMeta,
  AssessmentGoalDashboardContext,
  CompanyAssessmentGoal,
  DimensionPriority,
  RecommendationPriority,
  EvidencePriority,
  UploadPriority,
  DashboardWidgetSpec,
  ReportingTemplateSpec,
  OperatingLens,
  OperatingLensId,
} from "./assessment-goal";
export {
  ASSESSMENT_GOAL_IDS,
  DEFAULT_ASSESSMENT_GOAL,
} from "./assessment-goal";
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
export { formatEvidenceLabel } from "./evidence";
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
} from "./explain";
