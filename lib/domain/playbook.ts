/**
 * Due Diligence Playbook — Phase 7 domain types.
 * Playbooks reinterpret the same evidence for different business objectives.
 * Evidence, answers, findings, and snapshots remain shared and unchanged.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { CompanyLifecycleStage } from "./company-classification";
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
  /** Display name (API: name). */
  name: string;
  /** @deprecated Prefer name — kept for dashboard compatibility. */
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
  category?: string;
};

export type PlaybookUploadPriority = {
  id: string;
  label: string;
  /** Evidence category for “what to upload next”. */
  evidenceCategory: string;
  why: string;
  level: "required" | "recommended" | "optional";
  priority: number;
  /** Evidence type ids this upload would satisfy. */
  evidenceTypes: string[];
  /** Diligence questions this upload could help answer. */
  questionsItCouldAnswer: string[];
  /** Expected coverage impact 0–1 when uploaded. */
  expectedCoverageImpact: number;
  /** Stages where this upload is relevant; empty = all stages. */
  applicableStages: CompanyLifecycleStage[];
};

export type PlaybookExecutiveSummary = {
  playbookId: PlaybookId;
  title: string;
  headline: string;
  paragraphs: string[];
  focusAreas: string[];
  guidance: string[];
  snapshotId: string | null;
  generatedAt: string;
};

export type PlaybookReadiness = {
  playbookId: PlaybookId;
  playbookVersion: string;
  /** False when coverage is below the playbook minimum — do not publish readiness %. */
  readinessAvailable: boolean;
  readinessPercent: number | null;
  evidenceCoveragePercent: number;
  criticalBlockers: string[];
  highPriorityUploads: PlaybookUploadPriority[];
  topRecommendations: Recommendation[];
  unsupportedQuestions: string[];
  confidence: number | null;
  snapshotId: string | null;
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
  category?: string;
};

export type PlaybookReportSection = {
  id: string;
  title: string;
  description?: string;
};

export type PlaybookInterpretationContext = {
  companyId: string;
  playbookId: PlaybookId;
  snapshotId: string | null;
  companyStage: CompanyLifecycleStage | null;
  answers: DiligenceQuestionAnswer[];
  recommendations: Recommendation[];
  risks: Risk[];
  healthScore: HealthScore | null;
  coverage: QuestionCoverageReport | null;
  /** Evidence type ids already present (from the same snapshot / current store). */
  presentEvidenceTypes: string[];
  generatedAt?: string;
};

export type PlaybookProvenance = {
  companyId: string;
  snapshotId: string | null;
  playbookId: PlaybookId;
  playbookVersion: string;
  assessmentGoal: PlaybookId;
  companyStage: CompanyLifecycleStage | string | null;
  generatedAt: string;
};

export type PlaybookDashboardContext = {
  playbookId: PlaybookId;
  name: string;
  label: string;
  objective: string;
  playbookVersion: string;
  successCriteria: string[];
  focusAreas: string[];
  applicableLifecycleStages: CompanyLifecycleStage[];
  reportSections: PlaybookReportSection[];
  readiness: PlaybookReadiness;
  executiveSummary: PlaybookExecutiveSummary;
  uploadPriorities: PlaybookUploadPriority[];
  missingEvidence: PlaybookMissingEvidenceItem[];
  prioritizedQuestionIds: string[];
  prioritizedRecommendationIds: string[];
  criticalBlockers: string[];
  provenance: PlaybookProvenance;
};
