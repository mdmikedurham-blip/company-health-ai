/**
 * Due Diligence Playbook — Phase 7 domain types.
 * Playbooks reinterpret the same evidence for different business objectives.
 * Evidence storage and health scoring remain shared and unchanged.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type {
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "./diligence-question";
import type { HealthScore } from "./health";
import type { Recommendation } from "./recommendation";
import type { Risk } from "./risk";

/** Playbook id mirrors assessment goal — one playbook per operating mode. */
export type PlaybookId = AssessmentGoalId;

export const PLAYBOOK_IDS: PlaybookId[] = [
  "run-the-company",
  "raise-capital",
  "sell-the-company",
  "acquire-a-company",
  "board-readiness",
  "enterprise-sales",
  "annual-audit",
  "ipo-readiness",
];

export const DEFAULT_PLAYBOOK: PlaybookId = "run-the-company";

export const PLAYBOOK_ENGINE_VERSION = "playbook-engine-v1";

export type PlaybookMeta = {
  id: PlaybookId;
  label: string;
  objective: string;
};

export type PlaybookQuestionPriority = {
  questionId: string;
  weight: number;
  rationale: string;
};

export type PlaybookEvidenceSpec = {
  evidenceType: string;
  label: string;
  why: string;
  level: "required" | "recommended";
};

export type PlaybookUploadPriority = {
  id: string;
  label: string;
  why: string;
  level: "required" | "recommended" | "optional";
  /** Evidence type ids this upload would satisfy. */
  evidenceTypes: string[];
};

export type PlaybookExecutiveSummary = {
  playbookId: PlaybookId;
  title: string;
  headline: string;
  paragraphs: string[];
  focusAreas: string[];
  generatedAt: string;
};

export type PlaybookReadiness = {
  playbookId: PlaybookId;
  playbookVersion: string;
  readinessPercent: number;
  coveragePercent: number;
  criticalBlockers: string[];
  highPriorityUploads: PlaybookUploadPriority[];
  topRecommendations: Recommendation[];
  successCriteria: string[];
  generatedAt: string;
};

export type PlaybookMissingEvidenceItem = {
  evidenceType: string;
  label: string;
  level: "required" | "recommended";
  why: string;
  relatedQuestionIds: string[];
  priorityWeight: number;
};

export type PlaybookInterpretationContext = {
  companyId: string;
  playbookId: PlaybookId;
  answers: DiligenceQuestionAnswer[];
  recommendations: Recommendation[];
  risks: Risk[];
  healthScore: HealthScore | null;
  coverage: QuestionCoverageReport | null;
  /** Evidence type ids already present for the company. */
  presentEvidenceTypes: string[];
  generatedAt?: string;
};

export type PlaybookDashboardContext = {
  playbookId: PlaybookId;
  label: string;
  objective: string;
  playbookVersion: string;
  successCriteria: string[];
  focusAreas: string[];
  reportSections: string[];
  readiness: PlaybookReadiness;
  executiveSummary: PlaybookExecutiveSummary;
  uploadPriorities: PlaybookUploadPriority[];
  missingEvidence: PlaybookMissingEvidenceItem[];
  prioritizedQuestionIds: string[];
  prioritizedRecommendationIds: string[];
};
