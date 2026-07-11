/**
 * Due Diligence Question domain — Phase 4.
 * Questions are the canonical reasoning layer between evidence and findings.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { CompanyLifecycleStage } from "./company-classification";
import type { CompanyId, EvidenceId } from "./primitives";

export type DiligenceDimensionId =
  | "dim-financial"
  | "dim-governance"
  | "dim-legal"
  | "dim-customer"
  | "dim-security"
  | "dim-operations"
  | "dim-people";

export const DILIGENCE_DIMENSION_IDS: DiligenceDimensionId[] = [
  "dim-financial",
  "dim-governance",
  "dim-legal",
  "dim-customer",
  "dim-security",
  "dim-operations",
  "dim-people",
];

/** Never fabricate — only emit when evidence supports the conclusion. */
export type DiligenceAnswerState =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export const DILIGENCE_ANSWER_STATES: DiligenceAnswerState[] = [
  "SUPPORTED",
  "CONTRADICTED",
  "INSUFFICIENT_EVIDENCE",
  "NOT_APPLICABLE",
  "UNKNOWN",
];

export type QuestionImportance = "critical" | "high" | "medium" | "low";

export type QuestionStageLevel =
  | "required"
  | "optional"
  | "not_applicable";

export type DiligenceQuestionId = string;

export type RecommendationTemplate = {
  id: string;
  title: string;
  description: string;
  rationale: string;
  nextSteps: string[];
  effort: "low" | "medium" | "high";
  estimatedScoreImprovement: number;
};

/**
 * Catalog definition — static, versioned in code.
 * Assessment goals only change importance/ordering/weighting, not membership.
 */
export type DiligenceQuestionDefinition = {
  id: DiligenceQuestionId;
  title: string;
  dimension: DiligenceDimensionId;
  /** Goals this question is relevant to (all goals share the same catalog). */
  assessmentGoals: AssessmentGoalId[];
  /** Per-stage applicability. Missing stage → optional. */
  stageLevels: Partial<Record<CompanyLifecycleStage, QuestionStageLevel>>;
  /** Base importance (goals may reweight). */
  importance: QuestionImportance;
  /** Goal-specific importance multipliers (default 1). */
  goalImportance?: Partial<Record<AssessmentGoalId, number>>;
  requiredEvidenceTypes: string[];
  optionalEvidenceTypes: string[];
  /** Phase 5 — concepts this question evaluates (not documents). */
  evaluatesConceptIds?: string[];
  recommendationTemplate?: RecommendationTemplate;
};

export type DiligenceQuestionAnswer = {
  questionId: DiligenceQuestionId;
  companyId: CompanyId;
  state: DiligenceAnswerState;
  confidence: number;
  supportingEvidenceIds: EvidenceId[];
  missingEvidence: string[];
  reasoning: string;
  lastUpdated: string;
  snapshotId: string | null;
  /** Stage level applied when answered. */
  stageLevel: QuestionStageLevel;
  /** Effective importance after goal weighting (ordering only). */
  effectiveImportance: number;
  /** Concepts evaluated for this answer. */
  conceptIds?: string[];
};

export type QuestionCoverageReport = {
  companyId: CompanyId;
  snapshotId: string | null;
  generatedAt: string;
  applicable: number;
  answered: number;
  supported: number;
  contradicted: number;
  insufficientEvidence: number;
  notApplicable: number;
  unknown: number;
  lackingEvidence: number;
  /** answered / applicable (0–1). */
  coverageRatio: number;
  /** Mean confidence across answered applicable questions (0–100). */
  meanConfidence: number;
  byDimension: Record<
    DiligenceDimensionId,
    {
      applicable: number;
      supported: number;
      contradicted: number;
      insufficientEvidence: number;
      coverageRatio: number;
    }
  >;
};

export type DiligenceQuestionBundle = {
  catalogVersion: string;
  questions: DiligenceQuestionDefinition[];
  answers: DiligenceQuestionAnswer[];
  coverage: QuestionCoverageReport;
  prioritizedQuestionIds: DiligenceQuestionId[];
};
