import type {
  CompanyId,
  DimensionId,
  EvidenceId,
  FindingId,
  RecommendationId,
  RiskId,
  TimelineEventId,
  TimelineEventType,
} from "@/lib/domain/primitives";

/** Document slice used when connector sync introduces or updates files. */
export interface TimelineDocument {
  id: string;
  title: string;
  externalId?: string;
  contentHash?: string | null;
  modifiedAt?: string | null;
  connectorId?: string;
}

/** Prior analysis slice for deterministic event diffs. */
export interface TimelinePreviousSlice {
  findings: {
    id: FindingId;
    title: string;
    description: string;
    dimensionId: DimensionId;
    scoreImpact: number;
    materiality: number;
    confidence: number;
    evidenceIds: EvidenceId[];
    direction: string;
  }[];
  risks: {
    id: RiskId;
    title: string;
    summary: string;
    dimensionId: DimensionId;
    severity: string;
    status: string;
    confidence: number;
    evidenceIds: EvidenceId[];
    findingIds: FindingId[];
    estimatedScoreImpact: number;
  }[];
  recommendations?: {
    id: RecommendationId;
    title: string;
    priority: string;
    evidenceIds: EvidenceId[];
    riskIds: RiskId[];
  }[];
  dimensions?: {
    id: DimensionId;
    name: string;
    score: number;
  }[];
  healthScore?: {
    score: number;
    confidence: number;
  };
  evidenceIds?: EvidenceId[];
  documents?: TimelineDocument[];
}

export interface FindingDiff {
  created: FindingId[];
  updated: FindingId[];
  unchanged: FindingId[];
  removed: FindingId[];
}

export interface RiskDiff {
  created: RiskId[];
  updated: RiskId[];
  resolved: RiskId[];
  unchanged: RiskId[];
}

export interface DocumentDiff {
  added: TimelineDocument[];
  updated: TimelineDocument[];
}

export interface DimensionScoreDiff {
  dimensionId: DimensionId;
  dimension: string;
  previousScore: number;
  currentScore: number;
  change: number;
  findingIds: FindingId[];
  evidenceIds: EvidenceId[];
}

export interface AnalysisDiff {
  findings: FindingDiff;
  risks: RiskDiff;
  documents: DocumentDiff;
  evidenceCreated: EvidenceId[];
  dimensions: DimensionScoreDiff[];
  overallScore?: {
    previousScore: number;
    currentScore: number;
    change: number;
  };
  recommendationsCreated: RecommendationId[];
}

export interface CausalLinkMap {
  /** entity key → event id */
  byKey: Map<string, TimelineEventId>;
  /** evidence id → evidence-created event id */
  evidenceEventById: Map<EvidenceId, TimelineEventId>;
  /** finding id → finding event id */
  findingEventById: Map<FindingId, TimelineEventId>;
  /** risk id → risk event id */
  riskEventById: Map<RiskId, TimelineEventId>;
  /** dimension id → dimension-score event id */
  dimensionEventById: Map<DimensionId, TimelineEventId>;
  /** document id → document event id */
  documentEventById: Map<string, TimelineEventId>;
}

export type { CompanyId, TimelineEventType };
