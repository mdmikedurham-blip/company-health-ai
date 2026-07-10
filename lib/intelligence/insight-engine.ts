/**
 * Insight Engine — primary public API for the Company Health intelligence pipeline.
 *
 * Evidence → Insights → Findings → Risks → Health score impacts → Prioritized recommendations
 *
 * Rules-only in Phase 2. Architecture allows an LLM to replace evidence-analyzer
 * / finding synthesis later without changing the UI or domain model.
 *
 * Determinism: pass a fixed `asOf` (Date or ISO string). The same evidence + asOf
 * always produces the same snapshot. Wall clock is never read inside the engine.
 */

import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Insight,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
  TimelineEvent,
} from "@/lib/domain";
import { formatEvidenceLabel } from "@/lib/domain";
import { analyzeEvidence } from "./evidence-analyzer";
import { deriveFindings } from "./finding-engine";
import {
  attachRecommendationsToDimensions,
  generateRecommendations,
} from "./recommendation-engine";
import { assessRisks } from "./risk-engine";
import { computeHealthFromFindings } from "./scoring-engine";

/** Fixed assessment clock for Acme mock runs — keeps snapshots byte-stable. */
export const DEFAULT_AS_OF = "2026-07-09T13:42:00.000Z";

export interface InsightEngineInput {
  companyId: string;
  evidence: Evidence[];
  previousHealthScore?: HealthScore;
  /** Optional dimension profiles to preserve owner / whyItMatters metadata. */
  dimensionProfiles?: HealthDimension[];
  /**
   * Assessment clock. Same evidence + same asOf ⇒ identical engine output.
   * Defaults to DEFAULT_AS_OF (not wall clock).
   */
  asOf?: Date | string;
}

export interface InsightEngineOutput {
  insights: Insight[];
  findings: Finding[];
  risks: Risk[];
  healthScore: HealthScore;
  recommendations: Recommendation[];
  timelineEvents: TimelineEvent[];
  /** Enriched for snapshot assembly — used by the data layer. */
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation;
  evidence: Evidence[];
}

export function resolveAsOf(asOf?: Date | string): Date {
  if (asOf instanceof Date) return asOf;
  if (typeof asOf === "string") return new Date(asOf);
  return new Date(DEFAULT_AS_OF);
}

function formatTimelineDate(asOf: Date): string {
  return asOf.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimelineMonth(asOf: Date): string {
  return asOf.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function linkEvidence(
  evidence: Evidence[],
  findings: Finding[],
  risks: Risk[],
): Evidence[] {
  return evidence.map((item) => {
    const findingIds = findings
      .filter((f) => f.evidenceIds.includes(item.id))
      .map((f) => f.id);
    const linkedRiskIds = risks
      .filter((r) => r.evidenceIds.includes(item.id))
      .map((r) => r.id);
    return { ...item, findingIds, linkedRiskIds };
  });
}

function buildTimelineEvents(params: {
  findings: Finding[];
  risks: Risk[];
  evidence: Evidence[];
  healthScore: HealthScore;
  previousHealthScore?: HealthScore;
  asOf: Date;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const month = formatTimelineMonth(params.asOf);
  const today = formatTimelineDate(params.asOf);

  if (params.previousHealthScore) {
    events.push({
      id: "tl-engine-score",
      date: today,
      month,
      type: "score-change",
      title: `Health score ${params.healthScore.score}`,
      description: `Overall health ${params.healthScore.changeLabel} (was ${params.previousHealthScore.score}).`,
      scoreBefore: params.previousHealthScore.score,
      scoreAfter: params.healthScore.score,
      whyHealthChanged: params.healthScore.scoreExplanations
        ?.filter((e) => e.impacts.length > 0)
        .map((e) => `${e.dimensionId}: ${e.finalScore - e.baselineScore}`)
        .join("; "),
    });
  }

  for (const finding of params.findings) {
    events.push({
      id: `tl-finding-${finding.id}`,
      date: finding.extractedAt,
      month,
      type: "finding-created",
      title: finding.title,
      description: finding.description,
      dimensionId: finding.dimensionId,
      dimension: finding.dimension,
    });
  }

  for (const risk of params.risks) {
    events.push({
      id: `tl-risk-${risk.id}`,
      date: today,
      month,
      type: "risk-created",
      title: risk.title,
      description: risk.summary,
      dimensionId: risk.dimensionId,
      dimension: risk.dimension,
      whyHealthChanged: risk.whyItMatters,
    });
  }

  for (const item of params.evidence) {
    events.push({
      id: `tl-evidence-${item.id}`,
      date: item.collectedAt,
      month,
      type: "evidence-added",
      title: `${formatEvidenceLabel(item)} indexed`,
      description: item.contentSummary,
      dimensionId: item.dimensionId,
      dimension: item.dimension,
    });
  }

  return events;
}

/**
 * Primary entry point for the Company Health Insight Engine.
 */
export function runInsightEngine(input: InsightEngineInput): InsightEngineOutput {
  const asOf = resolveAsOf(input.asOf);
  const rawEvidence = input.evidence.map((e) => ({
    ...e,
    findingIds: e.findingIds ?? [],
    linkedRiskIds: e.linkedRiskIds ?? [],
  }));

  // Stage 1: Evidence → Insights
  const insights = analyzeEvidence(rawEvidence);

  // Stage 2: Insights → Findings
  const findings = deriveFindings(insights, rawEvidence);

  // Stage 3: Findings → Risks
  const risks = assessRisks(findings, rawEvidence);

  // Stage 4: Findings → Health scores
  const { dimensions, healthScore, scoreChange } = computeHealthFromFindings(
    findings,
    rawEvidence,
    input.previousHealthScore,
    input.dimensionProfiles,
    asOf,
  );

  // Stage 5: Risks → Prioritized recommendations
  const recommendations = generateRecommendations(risks, findings);
  attachRecommendationsToDimensions(dimensions, recommendations);

  // Stage 6: Link evidence ↔ findings ↔ risks
  const evidence = linkEvidence(rawEvidence, findings, risks);

  const timelineEvents = buildTimelineEvents({
    findings,
    risks,
    evidence,
    healthScore,
    previousHealthScore: input.previousHealthScore,
    asOf,
  });

  return {
    insights,
    findings,
    risks,
    healthScore,
    recommendations,
    timelineEvents,
    dimensions,
    scoreChange,
    evidence,
  };
}
