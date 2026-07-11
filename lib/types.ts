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
export type { EvidenceExplorerRecord as EvidenceRecordView } from "@/lib/application/evidence-explorer-model";

export type {
  ExplorerGraphNode,
  ExplorerGraphEdge,
  ExplorerNodeKind,
} from "@/lib/application/evidence-explorer-model";

/** @deprecated Prefer ExplorerGraphNode from evidence-explorer-model. */
export interface EvidenceGraphNode {
  id: string;
  label: string;
  type: "document" | "dimension" | "risk" | "insight" | "finding" | "recommendation" | "fact" | "cluster";
  x: number;
  y: number;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
}

export type {
  DoctorAnswer,
  DoctorEvidenceCitation,
  DoctorFindingRef,
  DoctorRiskRef,
  DoctorActionRef,
} from "@/lib/doctor/types";

import type { DoctorAnswer } from "@/lib/doctor/types";

export interface DoctorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  response?: DoctorAnswer;
  error?: string;
}

/** @deprecated Prefer DoctorAnswer — kept for gradual UI migration aliases. */
export type DoctorResponse = DoctorAnswer;

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
