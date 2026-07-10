import type {
  ActionPriority,
  BoardPrepStatus,
  DimensionId,
  EvidenceId,
  FindingDirection,
  FindingId,
  RecommendationId,
  RiskId,
  RiskSeverity,
  TimelineEventId,
} from "./primitives";

/** Prior period slice used for causal comparison. */
export interface BriefPreviousSlice {
  healthScore: {
    score: number;
    confidence: number;
  };
  dimensions?: {
    id: DimensionId;
    name: string;
    score: number;
  }[];
  findings?: {
    id: FindingId;
    dimensionId: DimensionId;
    scoreImpact: number;
  }[];
}

export interface DimensionScoreDelta {
  dimensionId: DimensionId;
  dimension: string;
  previousScore: number;
  currentScore: number;
  change: number;
}

export interface ScoreDeltaResult {
  previousScore: number;
  currentScore: number;
  change: number;
  byDimension: DimensionScoreDelta[];
}

export type BusinessMateriality = "high" | "medium" | "low";

export interface CausalDriver {
  id: string;
  /** CEO-facing driver label (finding title or evidence title). */
  title: string;
  dimensionId: DimensionId;
  dimension: string;
  direction: FindingDirection | "neutral";
  /** Signed health score impact in points (alias of impact for brief display). */
  healthImpact: number;
  /** Signed score impact in points. */
  impact: number;
  confidence: number;
  /** Number of linked evidence items. */
  evidenceCount: number;
  /** Mean evidence reliability for linked evidence (0–100). */
  evidenceQuality: number;
  /** Business materiality band for CEO prioritization. */
  businessMateriality: BusinessMateriality;
  /** Short reason this driver matters to the business. */
  reason: string;
  /**
   * Ranking weight:
   * abs(impact) × (confidence/100) × (evidenceQuality/100) × materialityMultiplier
   */
  weightedScore: number;
  /** Deterministic statement derived from finding/evidence titles. */
  statement: string;
  findingId?: FindingId;
  evidenceIds: EvidenceId[];
  riskId?: RiskId;
  recommendationId?: RecommendationId;
  timelineEventIds: TimelineEventId[];
}

export interface BriefRiskItem {
  riskId: RiskId;
  title: string;
  severity: RiskSeverity;
  dimension: string;
  summary: string;
  evidenceIds: EvidenceId[];
}

export interface BriefActionItem {
  recommendationId: RecommendationId;
  title: string;
  priority: ActionPriority;
  dimension: string;
  description: string;
  evidenceIds: EvidenceId[];
}

export interface BriefBoardImplication {
  title: string;
  status: BoardPrepStatus;
  detail: string;
  evidenceIds: EvidenceId[];
}

export interface BriefScoreChange {
  previousScore: number;
  currentScore: number;
  change: number;
}

export interface BriefSeed {
  /** Board meeting schedule — company calendar metadata only. */
  boardMeeting: {
    date: string;
    daysUntil: number;
    items: { title: string; status: BoardPrepStatus; detail?: string }[];
  };
}

/**
 * Causal Executive Brief — every material statement cites evidence IDs.
 * Generated deterministically from snapshot deltas; no mock copy.
 */
export interface ExecutiveBrief {
  headline: string;
  overallSummary: string;
  scoreChange: BriefScoreChange;
  primaryDrivers: CausalDriver[];
  secondaryDrivers: CausalDriver[];
  topRisks: BriefRiskItem[];
  recommendedActions: BriefActionItem[];
  boardImplications: BriefBoardImplication[];
  confidence: number;
  generatedAt: string;
  evidenceReferences: EvidenceId[];
  timelineReferences: TimelineEventId[];
  /** Display date for the briefing (UTC, from assessment clock). */
  date: string;
  /**
   * Board meeting calendar from seed (date / daysUntil).
   * Implications live in boardImplications; this is schedule metadata only.
   */
  boardMeeting?: {
    date: string;
    daysUntil: number;
  };
}
