/**
 * Map domain entities ↔ Supabase row shapes for the 10 canonical tables.
 */
import type {
  Company,
  Evidence,
  EvidenceCitation,
  ExtractedFacts,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
  ScoreImpactExplanation,
  TimelineEvent,
} from "@/lib/domain";
import type { Json, Tables, TablesInsert } from "./database.types";

type EvidenceRow = Tables<"evidence">;
type FindingRow = Tables<"findings">;
type RiskRow = Tables<"risks">;
type RecommendationRow = Tables<"recommendations">;
type HealthScoreRow = Tables<"health_scores">;
type TimelineEventRow = Tables<"timeline_events">;
type CompanyRow = Tables<"companies">;

function asJson(value: unknown): Json {
  return value as Json;
}

function asExtractedFacts(value: Json): ExtractedFacts {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ExtractedFacts;
  }
  return {};
}

function asCitation(value: Json): EvidenceCitation {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const c = value as Record<string, unknown>;
    return {
      label: typeof c.label === "string" ? c.label : "",
      uri: typeof c.uri === "string" ? c.uri : undefined,
      locator: typeof c.locator === "string" ? c.locator : undefined,
    };
  }
  return { label: "" };
}

function asMetadata(
  value: Json,
): Record<string, string | number | boolean | null> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string | number | boolean | null>;
  }
  return {};
}

// ─── Company ─────────────────────────────────────────────────────────────────

export function companyFromRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    founded: row.founded ?? "",
    stage: row.stage ?? "",
    employees: row.employees ?? 0,
    arr: row.arr ?? "",
  };
}

export function companyToInsert(company: Company): TablesInsert<"companies"> {
  return {
    id: company.id,
    name: company.name,
    plan: company.plan,
    founded: company.founded || null,
    stage: company.stage || null,
    employees: company.employees,
    arr: company.arr || null,
  };
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export function evidenceFromRow(row: EvidenceRow): Evidence {
  const reliabilityRaw = Number(row.reliability);
  // DB stores 0–1; domain / Insight Engine use 0–100.
  const reliability =
    reliabilityRaw <= 1 ? reliabilityRaw * 100 : reliabilityRaw;
  return {
    id: row.id,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    title: row.title,
    contentSummary: row.content_summary,
    extractedFacts: asExtractedFacts(row.extracted_facts),
    dimensionIds: row.dimension_ids,
    dimensionId: row.dimension_id,
    dimension: row.dimension,
    occurredAt: row.occurred_at,
    collectedAt: row.collected_at,
    reliability,
    metadata: asMetadata(row.metadata),
    citation: asCitation(row.citation),
    findingIds: row.finding_ids,
    linkedRiskIds: row.linked_risk_ids,
  };
}

export function evidenceToInsert(
  companyId: string,
  evidence: Evidence,
  documentId?: string | null,
): TablesInsert<"evidence"> {
  const reliability =
    evidence.reliability > 1
      ? Math.min(1, evidence.reliability / 100)
      : evidence.reliability;
  return {
    id: evidence.id,
    company_id: companyId,
    document_id: documentId ?? null,
    source_system: evidence.sourceSystem,
    source_type: evidence.sourceType,
    title: evidence.title,
    content_summary: evidence.contentSummary,
    extracted_facts: asJson(evidence.extractedFacts),
    dimension_ids: evidence.dimensionIds,
    dimension_id: evidence.dimensionId,
    dimension: evidence.dimension,
    occurred_at: evidence.occurredAt,
    collected_at: evidence.collectedAt,
    reliability,
    metadata: asJson(evidence.metadata),
    citation: asJson(evidence.citation),
    finding_ids: evidence.findingIds,
    linked_risk_ids: evidence.linkedRiskIds,
  };
}

// ─── Findings ────────────────────────────────────────────────────────────────

export function findingFromRow(row: FindingRow): Finding {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    summary: row.summary,
    dimensionId: row.dimension_id,
    dimension: row.dimension,
    insightIds: row.insight_ids,
    evidenceIds: row.evidence_ids,
    direction: row.direction,
    materiality: Number(row.materiality),
    confidence: Number(row.confidence),
    scoreImpact: Number(row.score_impact),
    sourceSystem: row.source_system,
    extractedAt: row.extracted_at,
  };
}

export function findingToInsert(
  companyId: string,
  finding: Finding,
): TablesInsert<"findings"> {
  return {
    id: finding.id,
    company_id: companyId,
    title: finding.title,
    description: finding.description,
    summary: finding.summary,
    dimension_id: finding.dimensionId,
    dimension: finding.dimension,
    insight_ids: finding.insightIds,
    evidence_ids: finding.evidenceIds,
    direction: finding.direction,
    materiality: finding.materiality,
    confidence: finding.confidence,
    score_impact: finding.scoreImpact,
    source_system: finding.sourceSystem,
    extracted_at: finding.extractedAt,
  };
}

// ─── Risks ───────────────────────────────────────────────────────────────────

export function riskFromRow(row: RiskRow): Risk {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    dimensionId: row.dimension_id,
    dimension: row.dimension,
    severity: row.severity,
    likelihood: Number(row.likelihood),
    impact: Number(row.impact),
    findingIds: row.finding_ids,
    evidenceIds: row.evidence_ids,
    confidence: Number(row.confidence),
    status: row.status,
    estimatedScoreImpact: Number(row.estimated_score_impact),
    whyItMatters: row.why_it_matters,
    recommendationId: row.recommendation_id ?? "",
    recommendation: row.recommendation,
    primaryEvidenceLabel: row.primary_evidence_label,
    explainPrompt: row.explain_prompt,
  };
}

export function riskToInsert(
  companyId: string,
  risk: Risk,
): TablesInsert<"risks"> {
  return {
    id: risk.id,
    company_id: companyId,
    title: risk.title,
    summary: risk.summary,
    dimension_id: risk.dimensionId,
    dimension: risk.dimension,
    severity: risk.severity,
    likelihood: risk.likelihood,
    impact: risk.impact,
    finding_ids: risk.findingIds,
    evidence_ids: risk.evidenceIds,
    confidence: risk.confidence,
    status: risk.status,
    estimated_score_impact: risk.estimatedScoreImpact,
    why_it_matters: risk.whyItMatters,
    recommendation_id: risk.recommendationId || null,
    recommendation: risk.recommendation,
    primary_evidence_label: risk.primaryEvidenceLabel,
    explain_prompt: risk.explainPrompt,
  };
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export function recommendationFromRow(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dimensionId: row.dimension_id,
    dimension: row.dimension,
    riskIds: row.risk_ids,
    evidenceIds: row.evidence_ids,
    findingIds: row.finding_ids,
    priority: row.priority,
    effort: row.effort,
    confidence: Number(row.confidence),
    estimatedScoreImprovement: Number(row.estimated_score_improvement),
    rationale: row.rationale,
    nextSteps: row.next_steps,
    priorityScore: Number(row.priority_score),
  };
}

export function recommendationToInsert(
  companyId: string,
  recommendation: Recommendation,
): TablesInsert<"recommendations"> {
  return {
    id: recommendation.id,
    company_id: companyId,
    title: recommendation.title,
    description: recommendation.description,
    dimension_id: recommendation.dimensionId,
    dimension: recommendation.dimension,
    risk_ids: recommendation.riskIds,
    evidence_ids: recommendation.evidenceIds,
    finding_ids: recommendation.findingIds,
    priority: recommendation.priority,
    effort: recommendation.effort,
    confidence: recommendation.confidence,
    estimated_score_improvement: recommendation.estimatedScoreImprovement,
    rationale: recommendation.rationale,
    next_steps: recommendation.nextSteps,
    priority_score: recommendation.priorityScore,
  };
}

// ─── Health scores ───────────────────────────────────────────────────────────

export function healthScoreFromRow(row: HealthScoreRow): {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation | null;
} {
  return {
    healthScore: {
      score: Number(row.score),
      status: row.status,
      change: Number(row.change),
      changeLabel: row.change_label,
      lastUpdated: row.as_of,
      confidence: Number(row.confidence),
      scoreExplanations: row.score_explanations as unknown as ScoreImpactExplanation[],
    },
    dimensions: (row.dimensions as unknown as HealthDimension[]) ?? [],
    scoreChange:
      (row.score_change as unknown as ScoreChangeExplanation | null) ?? null,
  };
}

export function healthScoreToInsert(
  companyId: string,
  healthScore: HealthScore,
  dimensions: HealthDimension[],
  scoreChange?: ScoreChangeExplanation | null,
  asOf?: string,
): TablesInsert<"health_scores"> {
  return {
    company_id: companyId,
    score: healthScore.score,
    status: healthScore.status,
    change: healthScore.change,
    change_label: healthScore.changeLabel,
    confidence: healthScore.confidence,
    dimensions: asJson(dimensions),
    score_explanations: asJson(healthScore.scoreExplanations ?? []),
    score_change: scoreChange ? asJson(scoreChange) : null,
    as_of: asOf ?? healthScore.lastUpdated,
  };
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export function timelineEventFromRow(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    date: row.event_date,
    month: row.month,
    type: row.type,
    title: row.title,
    description: row.description,
    scoreBefore: row.score_before != null ? Number(row.score_before) : undefined,
    scoreAfter: row.score_after != null ? Number(row.score_after) : undefined,
    dimensionId: row.dimension_id ?? undefined,
    dimension: row.dimension ?? undefined,
    whyHealthChanged: row.why_health_changed ?? undefined,
  };
}

export function timelineEventToInsert(
  companyId: string,
  event: TimelineEvent,
): TablesInsert<"timeline_events"> {
  return {
    id: event.id,
    company_id: companyId,
    event_date: event.date,
    month: event.month,
    type: event.type,
    title: event.title,
    description: event.description,
    score_before: event.scoreBefore ?? null,
    score_after: event.scoreAfter ?? null,
    dimension_id: event.dimensionId ?? null,
    dimension: event.dimension ?? null,
    why_health_changed: event.whyHealthChanged ?? null,
  };
}
