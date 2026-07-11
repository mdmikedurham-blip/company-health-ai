import type {
  EvidenceCatalog,
  ExecutiveBrief,
  HealthDimension,
  HealthDimensionSummary,
  HealthScore,
  Insight,
  Recommendation,
  RiskCardView,
  ScoreChangeExplanation,
  TimelineEvent,
} from "@/lib/domain";
import type {
  ConfidenceMethod,
  DimensionCoverage,
  ScoreMethod,
} from "./sanitize-health";

export type DashboardDataSource =
  | "persisted_analysis"
  | "empty_state"
  | "demo";

export type DashboardProvenance = {
  company_id: string;
  snapshot_id: string | null;
  prior_snapshot_id: string | null;
  generated_at: string | null;
  document_count: number;
  evidence_count: number;
  dimension_coverage: DimensionCoverage;
  score_method: ScoreMethod;
  confidence_method: ConfidenceMethod;
  source: DashboardDataSource;
};

export type DashboardMetric = {
  label: string;
  value: string;
  change: string;
};

export type TenantDashboardView = {
  provenance: DashboardProvenance;
  companyName: string;
  metrics: DashboardMetric[];
  healthScore: HealthScore;
  scoreChangeExplanation: ScoreChangeExplanation;
  executiveBrief: ExecutiveBrief;
  nextBestActions: Recommendation[];
  topRisks: RiskCardView[];
  healthDimensions: HealthDimensionSummary[];
  insights: Insight[];
  recommendations: Recommendation[];
  evidenceCatalog: EvidenceCatalog;
  timelineEvents: TimelineEvent[];
  dimensions: HealthDimension[];
};
