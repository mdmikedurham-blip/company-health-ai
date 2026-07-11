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
import type { EvidenceCoverageReport } from "@/lib/domain/evidence-coverage";
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
  /** Stage-aware diligence completeness — shown before health. */
  evidenceCoverage: EvidenceCoverageReport | null;
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
