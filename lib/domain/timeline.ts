import type {
  CompanyId,
  DimensionId,
  EvidenceId,
  FindingId,
  RiskId,
  TimelineEventId,
  TimelineEventType,
} from "./primitives";

/**
 * Causal timeline event — linked chain from document → score change.
 * Every material event carries provenance (evidence / document IDs)
 * and parent/root/chain links for expansion in the UI.
 */
export interface TimelineEvent {
  id: TimelineEventId;
  companyId: CompanyId;
  type: TimelineEventType;
  title: string;
  /** Primary narrative (preferred over description). */
  summary: string;
  /** @deprecated Prefer summary — kept for seed/DB compatibility. */
  description: string;
  occurredAt: string;
  /** Display date (human-readable). */
  date: string;
  month: string;
  sourceDocumentId?: string;
  evidenceIds: EvidenceId[];
  findingIds: FindingId[];
  riskIds: RiskId[];
  dimensionId?: DimensionId;
  dimension?: string;
  previousValue?: number | string;
  currentValue?: number | string;
  scoreDelta?: number;
  /** @deprecated Prefer previousValue — kept for UI score display. */
  scoreBefore?: number;
  /** @deprecated Prefer currentValue — kept for UI score display. */
  scoreAfter?: number;
  parentEventId?: TimelineEventId;
  rootEventId: TimelineEventId;
  causalChainId: string;
  confidence: number;
  whyHealthChanged?: string;
  metadata: Record<string, string | number | boolean | null>;
}
