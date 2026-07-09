/**
 * Shared domain model for the Company Health intelligence platform.
 *
 * Connectors emit Evidence into the Insight Engine. The engine produces
 * Findings → Risks → HealthScore impacts and Recommendations. The UI
 * consumes CompanyDNA (and related views) without knowing which connector
 * supplied any given piece of evidence.
 */

/** Supported health dimensions used across scoring and risk analysis. */
export type HealthDimensionId =
  | "financial"
  | "customer"
  | "governance"
  | "legal"
  | "revenue_quality"
  | "security"
  | "people"
  | "operations";

export type HealthStatus = "healthy" | "watch" | "risk";

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RecommendationPriority = "p0" | "p1" | "p2" | "p3";

export type Confidence = number; // 0–100

/** Origin system that produced a piece of evidence. */
export type ConnectorId =
  | "google_drive"
  | "box"
  | "quickbooks"
  | "carta"
  | "hubspot"
  | "stripe"
  | "gusto"
  | "salesforce"
  | "manual"
  | "fixture";

export type EvidenceKind =
  | "document"
  | "spreadsheet"
  | "metric"
  | "record"
  | "message"
  | "event"
  | "snapshot";

/**
 * Atomic fact pulled from a connected system.
 * Connectors normalize raw source data into Evidence before the engine runs.
 */
export interface Evidence {
  id: string;
  connectorId: ConnectorId;
  kind: EvidenceKind;
  /** Human-readable source label (file name, report, object type). */
  title: string;
  /** Optional deep link or path within the source system. */
  sourceUri?: string;
  /** Dimension this evidence most directly informs, when known. */
  dimension?: HealthDimensionId;
  /** Structured payload — metrics, excerpts, or normalized fields. */
  payload: Record<string, unknown>;
  /** Free-text excerpt or summary used for citation display. */
  excerpt?: string;
  observedAt: string; // ISO-8601
  ingestedAt: string; // ISO-8601
  confidence: Confidence;
  tags?: string[];
}

/**
 * Intermediate analytical claim derived from one or more Evidence items.
 * Findings are factual observations; Risks and Insights are higher-order.
 */
export interface Finding {
  id: string;
  title: string;
  summary: string;
  dimension: HealthDimensionId;
  evidenceIds: string[];
  /** Normalized signal strength used by downstream risk scoring (0–1). */
  signalStrength: number;
  confidence: Confidence;
  /** Optional structured metrics attached to the finding. */
  metrics?: Record<string, number | string | boolean>;
  createdAt: string;
}

/**
 * Narrative conclusion suitable for board/investor consumption.
 * Insights cite Findings (and transitively Evidence).
 */
export interface Insight {
  id: string;
  title: string;
  conclusion: string;
  dimension?: HealthDimensionId;
  findingIds: string[];
  evidenceIds: string[];
  confidence: Confidence;
  createdAt: string;
}

/**
 * Materialized risk derived from Findings.
 */
export interface Risk {
  id: string;
  label: string;
  detail: string;
  severity: RiskSeverity;
  dimension: HealthDimensionId;
  findingIds: string[];
  evidenceIds: string[];
  confidence: Confidence;
  /** Points deducted from the dimension score (0–100 scale contribution). */
  healthImpact: number;
  /** Trend relative to prior evaluation, when available. */
  trend?: "improving" | "stable" | "worsening";
  createdAt: string;
}

/**
 * Prioritized, actionable recommendation with evidence trail.
 */
export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  priority: RecommendationPriority;
  dimension: HealthDimensionId;
  riskIds: string[];
  evidenceIds: string[];
  confidence: Confidence;
  /** Estimated relative impact on overall health if addressed (0–100). */
  expectedImpact: number;
  ownerHint?: string;
  createdAt: string;
}

/**
 * One scored dimension within the overall health model.
 */
export interface HealthDimension {
  id: HealthDimensionId;
  name: string;
  description: string;
  score: number; // 0–100
  status: HealthStatus;
  weight: number; // relative weight in overall score
  riskIds: string[];
  findingIds: string[];
}

/**
 * Aggregate company health score with dimension breakdown.
 */
export interface HealthScore {
  overall: number; // 0–100
  status: HealthStatus;
  dimensions: HealthDimension[];
  computedAt: string;
  evidenceCount: number;
  riskCount: number;
}

/**
 * Chronological event in the company's intelligence timeline.
 */
export interface TimelineEvent {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  kind: "ingestion" | "finding" | "risk" | "recommendation" | "score_change" | "connector";
  dimension?: HealthDimensionId;
  relatedIds?: string[];
  connectorId?: ConnectorId;
}

/**
 * Full intelligence snapshot for a company — the primary UI contract.
 * Pages consume CompanyDNA; they never talk to connectors directly.
 */
export interface CompanyDNA {
  companyId: string;
  companyName: string;
  industry?: string;
  stage?: string;
  health: HealthScore;
  evidence: Evidence[];
  findings: Finding[];
  insights: Insight[];
  risks: Risk[];
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  connectedSystems: ConnectorId[];
  generatedAt: string;
}

/** Metadata describing a health dimension for UI catalogs. */
export interface HealthDimensionMeta {
  id: HealthDimensionId;
  name: string;
  description: string;
  defaultWeight: number;
  iconPath: string;
}
