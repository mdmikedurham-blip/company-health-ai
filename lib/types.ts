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
  ConnectorSummary,
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

/** Evidence explorer list view projection */
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

import type { RiskSeverity } from "@/lib/domain";
