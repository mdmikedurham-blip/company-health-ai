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
import type {
  CompanyLifecycleStage,
  ConfirmedClassificationOverrides,
} from "@/lib/domain/company-classification";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "@/lib/domain/diligence-question";
import { classifyCompanyFromEvidence } from "@/lib/classification";
import {
  answerDiligenceQuestions,
  deriveFindingsFromAnswers,
  generateRecommendationsFromAnswers,
  computeQuestionCoverage,
  prioritizeQuestionIds,
} from "@/lib/diligence";
import { analyzeEvidence } from "./evidence-analyzer";
import { attachRecommendationsToDimensions } from "./recommendation-engine";
import { assessRisks } from "./risk-engine";
import { computeHealthFromFindings } from "./scoring-engine";
import {
  buildCausalTimeline,
  type TimelineDocument,
  type TimelinePreviousSlice,
} from "./timeline";

/** Fixed assessment clock for Acme mock runs — keeps snapshots byte-stable. */
export const DEFAULT_AS_OF = "2026-07-09T13:42:00.000Z";

export interface InsightEngineInput {
  companyId: string;
  evidence: Evidence[];
  previousHealthScore?: HealthScore;
  /** Optional prior analysis slice for causal timeline diffs. */
  previous?: TimelinePreviousSlice;
  /** Optional documents from connector sync for document-added/updated events. */
  documents?: TimelineDocument[];
  /** Optional map evidenceId → source document id. */
  evidenceDocumentIds?: Record<string, string>;
  /** Optional dimension profiles to preserve owner / whyItMatters metadata. */
  dimensionProfiles?: HealthDimension[];
  /**
   * Assessment clock. Same evidence + same asOf ⇒ identical engine output.
   * Defaults to DEFAULT_AS_OF (not wall clock).
   */
  asOf?: Date | string;
  /** User-confirmed classification overrides (never overwritten by inference). */
  confirmedOverrides?: ConfirmedClassificationOverrides;
  /** Force stage when already persisted; otherwise inferred from evidence. */
  classificationStage?: CompanyLifecycleStage | null;
  /** Assessment goal — reorders/weights questions; never changes answers. */
  assessmentGoal?: AssessmentGoalId | null;
  /** Analysis snapshot id for answer provenance. */
  snapshotId?: string | null;
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
  /** Stage used for scoring / N/A gating. */
  classificationStage: CompanyLifecycleStage | null;
  /** Phase 4 — diligence question answers (canonical reasoning layer). */
  questionAnswers: DiligenceQuestionAnswer[];
  questionCoverage: QuestionCoverageReport;
  prioritizedQuestionIds: string[];
}

export function resolveAsOf(asOf?: Date | string): Date {
  if (asOf instanceof Date) return asOf;
  if (typeof asOf === "string") return new Date(asOf);
  return new Date(DEFAULT_AS_OF);
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

/**
 * Primary entry point for the Company Health Insight Engine.
 *
 * Pipeline (Phase 4):
 * Evidence → Question Answers → Findings → Risks → Health → Recommendations
 */
export function runInsightEngine(input: InsightEngineInput): InsightEngineOutput {
  const asOf = resolveAsOf(input.asOf);
  const asOfIso = asOf.toISOString();
  const rawEvidence = input.evidence.map((e) => ({
    ...e,
    findingIds: e.findingIds ?? [],
    linkedRiskIds: e.linkedRiskIds ?? [],
  }));

  // Stage 0: classification (stage-aware applicability)
  const classified = classifyCompanyFromEvidence({
    evidence: rawEvidence,
    confirmed: input.confirmedOverrides,
  });
  const stage =
    input.classificationStage ??
    (rawEvidence.length > 0 ? classified.stage : null);
  const classificationReady = rawEvidence.length > 0 && stage != null;

  // Stage 1: Evidence → Insights (retained for timeline / doctor context)
  const insights = analyzeEvidence(rawEvidence);

  // Stage 2: Evidence → Diligence Question Answers (canonical)
  const { answers: questionAnswers, evaluations } = answerDiligenceQuestions({
    companyId: input.companyId,
    evidence: rawEvidence,
    stage,
    assessmentGoal: input.assessmentGoal,
    snapshotId: input.snapshotId,
    asOf: asOfIso,
  });
  const questionCoverage = computeQuestionCoverage({
    companyId: input.companyId,
    answers: questionAnswers,
    snapshotId: input.snapshotId,
    generatedAt: asOfIso,
  });
  const prioritizedQuestionIds = prioritizeQuestionIds(
    questionAnswers,
    input.assessmentGoal,
  );

  // Stage 3: Question Answers → Findings (not documents → findings)
  const findings = deriveFindingsFromAnswers(evaluations, rawEvidence);

  // Stage 4: Findings → Risks
  const risks = assessRisks(findings, rawEvidence);

  // Stage 5: Findings → Health (question outcomes via findings)
  const { dimensions, healthScore, scoreChange } = computeHealthFromFindings(
    findings,
    rawEvidence,
    input.previousHealthScore,
    input.dimensionProfiles,
    asOf,
    { stage, classificationReady },
  );

  // Overlay question confidence only when we have evidence-backed answers.
  const evidenceBacked =
    questionCoverage.supported + questionCoverage.contradicted;
  if (evidenceBacked > 0) {
    healthScore.confidence = Math.round(
      healthScore.confidence * 0.5 + questionCoverage.meanConfidence * 0.5,
    );
  }

  // Stage 6: Recommendations only from contradicted / insufficient questions
  const recommendations = generateRecommendationsFromAnswers(questionAnswers, {
    evidenceCount: rawEvidence.length,
  });
  attachRecommendationsToDimensions(dimensions, recommendations);

  // Stage 7: Link evidence ↔ findings ↔ risks
  const evidence = linkEvidence(rawEvidence, findings, risks);

  // Stage 8: Causal timeline
  const previous: TimelinePreviousSlice | undefined = input.previous
    ? input.previous
    : input.previousHealthScore
      ? {
          findings: [],
          risks: [],
          healthScore: {
            score: input.previousHealthScore.score,
            confidence: input.previousHealthScore.confidence,
          },
          evidenceIds: [],
        }
      : undefined;

  const timelineEvents = buildCausalTimeline({
    companyId: input.companyId,
    findings,
    risks,
    evidence,
    dimensions,
    healthScore,
    recommendations,
    previous,
    documents: input.documents,
    evidenceDocumentIds: input.evidenceDocumentIds,
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
    classificationStage: stage,
    questionAnswers,
    questionCoverage,
    prioritizedQuestionIds,
  };
}
