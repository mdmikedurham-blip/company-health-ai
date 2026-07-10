/**
 * UI-layer types not part of the core company health domain.
 * Domain entity types live in @/lib/domain.
 */
export type {
  ActionPriority,
  BoardPrepStatus,
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  ConnectorStatus,
  DimensionId,
  Evidence,
  EvidenceCatalog,
  EvidenceId,
  ExecutiveBrief,
  Finding,
  HealthDimension,
  HealthDimensionSummary,
  HealthScore,
  HealthStatus,
  Insight,
  Recommendation,
  RecommendationId,
  Report,
  ReportId,
  ReportStatus,
  ReportType,
  Risk,
  RiskId,
  RiskSeverity,
  ScoreChangeExplanation,
  TimelineEvent,
  TimelineEventId,
  TimelineEventType,
  Trend,
  TrendDirection,
} from "@/lib/domain";

/** @deprecated Use Evidence */
export type { Evidence as EvidenceItem } from "@/lib/domain";

/** @deprecated Use Recommendation */
export type { Recommendation as RecommendedAction } from "@/lib/domain";

/** @deprecated Use HealthDimension */
export type { HealthDimension as HealthDimensionDetail } from "@/lib/domain";

/** @deprecated Use Risk */
export type { Risk as RiskDetail } from "@/lib/domain";

/** @deprecated Use RiskSeverity */
export type { RiskSeverity as RiskLevel } from "@/lib/domain";

/** Legacy flat dimension row shape */
export interface HealthDimensionRow {
  id?: string;
  name: string;
  score: number;
  status: HealthStatus;
  trend: TrendDirection;
  trendValue: number;
}

/** Evidence explorer list view */
export interface EvidenceRecordView {
  id: string;
  sourceSystem: string;
  documentName: string;
  confidence: number;
  dimension: string;
  lastReviewed: string;
  summary: string;
  linkedRisks: string[];
  linkedInsights: string[];
}

/** @deprecated Use EvidenceRecordView */
export type EvidenceRecord = EvidenceRecordView;

/** @deprecated Use ConnectorSummary from domain */
export interface EvidenceSource {
  id: string;
  name: string;
  system: string;
  documentsAnalyzed: number;
  lastSynced: string;
}

export interface EvidenceGraphNode {
  id: string;
  label: string;
  type: "document" | "dimension" | "risk" | "insight";
  x: number;
  y: number;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
}

export interface DoctorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  response?: DoctorResponse;
}

export interface DoctorResponse {
  summary: string;
  riskLevel: RiskSeverity;
  evidenceSources: string[];
  recommendedAction: string;
}

/** @deprecated Use Insight from domain */
export type AIInsight = Insight;

export interface ExplainPayload {
  type: "risk" | "dimension";
  id: string;
  title: string;
  subtitle: string;
  whyItMatters: string;
  scoreImpact: string;
  confidence: number;
  evidenceSources: { id: string; label: string; system: string }[];
  recommendedAction: string;
  estimatedScoreImprovement: number;
}

// Re-import Insight for AIInsight alias
import type { HealthStatus, Insight, RiskSeverity, TrendDirection } from "@/lib/domain";
