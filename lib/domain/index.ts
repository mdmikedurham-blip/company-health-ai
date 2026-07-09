export type {
  CompanyDNA,
  Confidence,
  ConnectorId,
  Evidence,
  EvidenceKind,
  Finding,
  HealthDimension,
  HealthDimensionId,
  HealthDimensionMeta,
  HealthScore,
  HealthStatus,
  Insight,
  Recommendation,
  RecommendationPriority,
  Risk,
  RiskSeverity,
  TimelineEvent,
} from "./types";

export {
  CONNECTOR_CATALOG,
  HEALTH_DIMENSIONS,
  clampScore,
  dimensionMeta,
  severityRank,
  statusFromScore,
} from "./constants";
