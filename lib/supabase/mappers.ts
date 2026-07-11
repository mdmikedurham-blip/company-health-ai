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
import {
  canonicalizeEvidenceUuid,
  isUuid,
} from "@/lib/uploads/evidence-id";
import {
  stableFindingUuid,
  stableRecommendationUuid,
  stableRiskUuid,
  stableTimelineEventUuid,
} from "@/lib/domain/stable-uuid";

type EvidenceRow = Tables<"evidence">;
type FindingRow = Tables<"findings">;
type RiskRow = Tables<"risks">;
type RecommendationRow = Tables<"recommendations">;
type HealthScoreRow = Tables<"health_scores">;
type TimelineEventRow = Tables<"timeline_events">;
type CompanyRow = Tables<"companies">;

/** Domain id for uuid PK tables: prefer human stable_key when present. */
function domainIdFromStableRow(row: {
  id: string;
  stable_key?: string | null;
}): string {
  return row.stable_key || row.id;
}

function dbUuidFromStableKey(
  domainId: string,
  toUuid: (key: string) => string,
): { id: string; stableKey: string | null } {
  if (isUuid(domainId)) {
    return { id: domainId, stableKey: null };
  }
  return { id: toUuid(domainId), stableKey: domainId };
}

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

  // evidence.id is uuid — never persist legacy `upload-${uuid}` strings.
  const id = canonicalizeEvidenceUuid(evidence.id, "evidenceToInsert.id");
  const metaDocId = evidence.metadata?.documentId ?? evidence.metadata?.document_id;
  const linkedDocumentId =
    documentId ??
    (typeof metaDocId === "string" && metaDocId.length > 0 ? metaDocId : null);
  const document_id = linkedDocumentId
    ? canonicalizeEvidenceUuid(
        String(linkedDocumentId),
        "evidenceToInsert.document_id",
      )
    : null;

  const metadata = {
    ...evidence.metadata,
    ...(id !== evidence.id
      ? { externalKey: `upload:${id}`, legacyEvidenceId: evidence.id }
      : {}),
  };

  return {
    id,
    company_id: companyId,
    document_id,
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
    metadata: asJson(metadata),
    citation: asJson(evidence.citation),
    finding_ids: evidence.findingIds,
    linked_risk_ids: evidence.linkedRiskIds,
  };
}

// ─── Findings ────────────────────────────────────────────────────────────────

export function findingFromRow(row: FindingRow): Finding {
  return {
    id: domainIdFromStableRow(row),
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
  const { id, stableKey } = dbUuidFromStableKey(
    finding.id,
    stableFindingUuid,
  );
  return {
    id,
    stable_key: stableKey,
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
    id: domainIdFromStableRow(row),
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
  const { id, stableKey } = dbUuidFromStableKey(risk.id, stableRiskUuid);
  return {
    id,
    stable_key: stableKey,
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

export function recommendationFromRow(
  row: RecommendationRow,
): Recommendation {
  return {
    id: domainIdFromStableRow(row),
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
  const { id, stableKey } = dbUuidFromStableKey(
    recommendation.id,
    stableRecommendationUuid,
  );
  return {
    id,
    stable_key: stableKey,
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
  const dimensions = ((row.dimensions as unknown as HealthDimension[]) ?? []).map(
    (d) => ({
      ...d,
      scored:
        d.scored !== false &&
        d.status !== "insufficient" &&
        ((d.findingIds?.length ?? 0) > 0 || d.scored === true),
    }),
  );
  const scoreChange =
    (row.score_change as unknown as ScoreChangeExplanation | null) ?? null;
  const status = row.status as HealthScore["status"];
  const scoreAvailable =
    status !== "insufficient" &&
    (dimensions.some((d) => d.scored) || Number(row.score) > 0);

  return {
    healthScore: {
      score: Number(row.score),
      scoreAvailable,
      status,
      change: Number(row.change),
      changeLabel: row.change_label,
      lastUpdated: row.as_of,
      confidence: Number(row.confidence),
      scoreExplanations: row.score_explanations as unknown as ScoreImpactExplanation[],
    },
    dimensions,
    scoreChange: scoreChange
      ? {
          ...scoreChange,
          hasPriorSnapshot: scoreChange.hasPriorSnapshot === true,
        }
      : null,
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
  const summary = row.summary ?? row.description;
  const rootEventId = row.root_event_id ?? row.id;
  const metadata = {
    ...((row.metadata as TimelineEvent["metadata"]) ?? {}),
    ...(row.event_key ? { eventKey: row.event_key } : {}),
  };
  return {
    id: row.id,
    companyId: row.company_id,
    date: row.event_date,
    month: row.month,
    type: row.type as TimelineEvent["type"],
    title: row.title,
    summary,
    description: row.description,
    occurredAt: row.occurred_at ?? `${row.event_date}T00:00:00.000Z`,
    scoreBefore: row.score_before != null ? Number(row.score_before) : undefined,
    scoreAfter: row.score_after != null ? Number(row.score_after) : undefined,
    dimensionId: row.dimension_id ?? undefined,
    dimension: row.dimension ?? undefined,
    whyHealthChanged: row.why_health_changed ?? undefined,
    sourceDocumentId: row.source_document_id ?? undefined,
    evidenceIds: row.evidence_ids ?? [],
    findingIds: row.finding_ids ?? [],
    riskIds: row.risk_ids ?? [],
    previousValue:
      row.previous_value != null ? Number(row.previous_value) : undefined,
    currentValue:
      row.current_value != null ? Number(row.current_value) : undefined,
    scoreDelta: row.score_delta != null ? Number(row.score_delta) : undefined,
    parentEventId: row.parent_event_id ?? undefined,
    rootEventId,
    causalChainId: row.causal_chain_id ?? `chain-${rootEventId}`,
    confidence: Number(row.confidence ?? 0),
    metadata,
  };
}

export function timelineEventToInsert(
  companyId: string,
  event: TimelineEvent,
): TablesInsert<"timeline_events"> {
  const previousNumeric =
    typeof event.previousValue === "number"
      ? event.previousValue
      : event.scoreBefore ?? null;
  const currentNumeric =
    typeof event.currentValue === "number"
      ? event.currentValue
      : event.scoreAfter ?? null;
  const metaEventKey =
    typeof event.metadata?.eventKey === "string"
      ? event.metadata.eventKey
      : null;
  const eventKey = metaEventKey ?? (!isUuid(event.id) ? event.id : null);
  const id = isUuid(event.id)
    ? event.id
    : stableTimelineEventUuid(eventKey ?? event.id);
  const metadata = {
    ...(event.metadata ?? {}),
    ...(eventKey ? { eventKey } : {}),
  };
  return {
    id,
    event_key: eventKey,
    company_id: companyId,
    event_date: event.date,
    month: event.month,
    type: event.type,
    title: event.title,
    description: event.description || event.summary,
    summary: event.summary,
    occurred_at: event.occurredAt,
    score_before: event.scoreBefore ?? null,
    score_after: event.scoreAfter ?? null,
    dimension_id: event.dimensionId ?? null,
    dimension: event.dimension ?? null,
    why_health_changed: event.whyHealthChanged ?? null,
    source_document_id: event.sourceDocumentId ?? null,
    evidence_ids: event.evidenceIds ?? [],
    finding_ids: event.findingIds ?? [],
    risk_ids: event.riskIds ?? [],
    previous_value: previousNumeric,
    current_value: currentNumeric,
    score_delta: event.scoreDelta ?? null,
    parent_event_id: event.parentEventId
      ? isUuid(event.parentEventId)
        ? event.parentEventId
        : stableTimelineEventUuid(event.parentEventId)
      : null,
    root_event_id: isUuid(event.rootEventId)
      ? event.rootEventId
      : event.rootEventId
        ? stableTimelineEventUuid(event.rootEventId)
        : id,
    causal_chain_id: event.causalChainId,
    confidence: event.confidence,
    metadata: asJson(metadata),
  };
}
