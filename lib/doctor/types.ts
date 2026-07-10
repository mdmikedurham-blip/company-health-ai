import type {
  Evidence,
  Finding,
  HealthDimension,
  Recommendation,
  Risk,
  RiskSeverity,
  TimelineEvent,
} from "@/lib/domain";

/** High-level intent inferred from the user question. */
export type DoctorQueryIntent =
  | "risks"
  | "governance"
  | "customer_concentration"
  | "fundraising"
  | "board_update"
  | "evidence"
  | "health"
  | "recommendations"
  | "general"
  | "unsupported";

export interface ClassifiedQuery {
  question: string;
  normalizedQuestion: string;
  tokens: string[];
  intent: DoctorQueryIntent;
  /** Dimension IDs hinted by the question (e.g. governance → dim-governance). */
  dimensionHints: string[];
  /** Extra keywords boosted for retrieval (synonyms, intent terms). */
  boostTerms: string[];
}

export interface RankedItem<T> {
  item: T;
  score: number;
  matchedTerms: string[];
}

export interface RetrievalResult {
  evidence: RankedItem<Evidence>[];
  findings: RankedItem<Finding>[];
  risks: RankedItem<Risk>[];
  recommendations: RankedItem<Recommendation>[];
  dimensions: RankedItem<HealthDimension>[];
  timeline: RankedItem<TimelineEvent>[];
  /** True when no entity scored above the relevance floor. */
  insufficientEvidence: boolean;
  topScore: number;
}

export interface DoctorEvidenceCitation {
  id: string;
  label: string;
  sourceSystem: string;
  title: string;
  href: string;
}

export interface DoctorFindingRef {
  id: string;
  title: string;
  dimension: string;
}

export interface DoctorRiskRef {
  id: string;
  title: string;
  severity: RiskSeverity;
  dimension: string;
}

export interface DoctorActionRef {
  id: string;
  title: string;
  priority: string;
}

/**
 * Structured evidence-backed answer returned by Company Doctor.
 * Every material claim must be grounded in evidenceCitations.
 */
export interface DoctorAnswer {
  answer: string;
  summary: string;
  riskLevel: RiskSeverity;
  confidence: number;
  evidenceCitations: DoctorEvidenceCitation[];
  relevantFindings: DoctorFindingRef[];
  relevantRisks: DoctorRiskRef[];
  recommendedActions: DoctorActionRef[];
  limitations: string[];
  insufficientEvidence: boolean;
}

/** Compact context passed to the LLM provider — never invent beyond this. */
export interface DoctorContext {
  question: string;
  intent: DoctorQueryIntent;
  companyName: string;
  healthScore: {
    score: number;
    status: string;
    changeLabel: string;
    confidence: number;
  };
  evidence: Array<{
    id: string;
    sourceSystem: string;
    title: string;
    contentSummary: string;
    dimension: string;
    reliability: number;
    extractedFacts: Record<string, string | number | boolean | string[] | null>;
  }>;
  findings: Array<{
    id: string;
    title: string;
    description: string;
    dimension: string;
    direction: string;
    materiality: number;
    confidence: number;
    evidenceIds: string[];
  }>;
  risks: Array<{
    id: string;
    title: string;
    summary: string;
    severity: RiskSeverity;
    dimension: string;
    whyItMatters: string;
    recommendation: string;
    evidenceIds: string[];
    confidence: number;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    evidenceIds: string[];
    nextSteps: string[];
  }>;
  dimensions: Array<{
    id: string;
    name: string;
    score: number;
    status: string;
    summary: string;
    evidenceIds: string[];
  }>;
  timeline: Array<{
    id: string;
    date: string;
    title: string;
    description: string;
    type: string;
  }>;
  insufficientEvidence: boolean;
}

export interface DoctorAskRequest {
  question: string;
  companyId?: string;
  /** Optional risk id from explain deep-links — boosts that risk in retrieval. */
  explainRiskId?: string;
}

export interface DoctorAskResponse {
  answer: DoctorAnswer;
  classified: Pick<ClassifiedQuery, "intent" | "dimensionHints">;
}
