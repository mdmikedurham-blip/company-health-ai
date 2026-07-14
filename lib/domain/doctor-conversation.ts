/**
 * Company Doctor Conversation Engine — Phase 8/11 domain types.
 * Mentor workflow: Observe → Diagnose → Ask ONE → Request ONE evidence → Recommend ONE.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { CompanyLifecycleStage } from "./company-classification";
import type {
  DoctorAlternativePath,
  DoctorWhatChanged,
  EnterpriseValueEstimate,
} from "./enterprise-value";
import type { CompanyId } from "./primitives";
import type { MoneyRange } from "./value-navigator";

export type DoctorConversationStatus = "active" | "archived" | "closed";

export type DoctorInvestigationStatus =
  | "open"
  | "asking"
  | "awaiting_evidence"
  | "analyzing"
  | "recommended"
  | "completed"
  | "dismissed";

export type DoctorInvestigationTemplateId =
  | "inv-revenue-slowing"
  | "inv-cash-declining"
  | "inv-runway-shortening"
  | "inv-customer-concentration"
  | "inv-hiring-too-quickly"
  | "inv-governance-gaps"
  | "inv-board-approvals"
  | "inv-security-readiness"
  | "inv-legal-risk"
  | "inv-operational-efficiency"
  | "inv-product-execution";

export type DoctorEvidenceRequest = {
  id: string;
  label: string;
  evidenceTypes: string[];
  why: string;
  expectedInsight: string;
  estimatedEffort: "low" | "medium" | "high";
  connectAlternative?: string;
  level: "required" | "recommended";
  /** Phase 10/11 — value framing when requesting evidence. */
  expectedValueImpactLabel?: string;
  expectedConfidenceIncrease?: number;
  estimatedTime?: string;
  estimatedValueImpact?: MoneyRange | null;
  questionsItMayAnswer?: string[];
  connectorOrUploadType?: "upload" | "connector";
  whyRanksAboveAlternatives?: string;
};

export type DoctorNextAction = {
  id: string;
  title: string;
  description: string;
  rationale: string;
  /** Explainability chain. */
  findingIds?: string[];
  questionIds?: string[];
  evidenceIds?: string[];
  documentIds?: string[];
  whyItMatters?: string;
  expectedInsight?: string;
  estimatedEffort?: "low" | "medium" | "high";
  /** Expected confidence improvement from completing this action. */
  estimatedConfidenceIncrease?: number;
  /** Expected enterprise value increase range. */
  estimatedValueImpact?: MoneyRange | null;
  /** Alias used in EV Opportunity framing. */
  expectedEnterpriseValueIncrease?: MoneyRange | null;
  /** Evidence required before / with this recommendation. */
  evidenceRequired?: string[];
  questionsItMayAnswer?: string[];
  connectorOrUploadType?: "upload" | "connector";
  whyRanksAboveAlternatives?: string;
};

export type DoctorConversationTurn = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  investigationId?: string | null;
};

export type DoctorLearnedItem = {
  id: string;
  text: string;
  learnedAt: string;
  investigationId?: string | null;
  evidenceTypes?: string[];
};

export type DoctorInvestigationExplainability = {
  recommendationId?: string | null;
  findingIds: string[];
  questionIds: string[];
  evidenceIds: string[];
  documentIds: string[];
};

export type DoctorInvestigation = {
  id: string;
  conversationId: string;
  companyId: CompanyId;
  templateId: DoctorInvestigationTemplateId | string;
  title: string;
  businessQuestion: string;
  /** Phase 11 — what the system noticed. */
  observation: string | null;
  primaryHypothesis: string | null;
  alternativeHypotheses: string[];
  /** Legacy array — keep for templates; prefer primary + alternative. */
  hypotheses: string[];
  requiredEvidence: DoctorEvidenceRequest[];
  supportingFactKeys: string[];
  supportingEvidenceIds: string[];
  confidence: number;
  /** 0–100 materiality. */
  materiality: number | null;
  expectedBusinessImpact: string | null;
  blockingUnknowns: string[];
  status: DoctorInvestigationStatus;
  priority: number;
  currentQuestion: string | null;
  evidenceRequest: DoctorEvidenceRequest | null;
  recommendation: DoctorNextAction | null;
  estimatedConfidenceGain: number | null;
  estimatedValueImpact: MoneyRange | null;
  explainability: DoctorInvestigationExplainability;
  snapshotId: string | null;
  openedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type DoctorConversation = {
  id: string;
  companyId: CompanyId;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId | string | null;
  companyStage: CompanyLifecycleStage | string | null;
  status: DoctorConversationStatus;
  currentTopic: string | null;
  currentInvestigationId: string | null;
  currentHypothesis: string | null;
  confidence: number;
  unansweredQuestions: string[];
  requestedEvidence: DoctorEvidenceRequest[];
  completedInvestigationIds: string[];
  conversationHistory: DoctorConversationTurn[];
  recentlyLearned: DoctorLearnedItem[];
  topObservation: string | null;
  nextAction: DoctorNextAction | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Doctor home payload — primary product experience. */
export type DoctorHomeView = {
  conversation: DoctorConversation;
  currentInvestigation: DoctorInvestigation | null;
  topObservation: string;
  currentConfidence: number;
  /** Exactly one primary next action (or null). */
  nextRecommendedAction: DoctorNextAction | null;
  /** Exactly one evidence request when awaiting evidence. */
  requestedEvidence: DoctorEvidenceRequest[];
  recentlyLearned: DoctorLearnedItem[];
  completedInvestigations: DoctorInvestigation[];
  workflowPhase:
    | "observe"
    | "diagnose"
    | "hypothesize"
    | "ask"
    | "request_evidence"
    | "analyze"
    | "recommend";
  mentorMessage: string;
  /** Phase 11 — transparent enterprise value for Doctor page. */
  enterpriseValue: EnterpriseValueEstimate | null;
  /** ≤3 lower-priority alternatives. */
  alternativePaths: DoctorAlternativePath[];
  /** After re-analysis / evidence arrival. */
  whatChanged: DoctorWhatChanged | null;
  provenance: {
    companyId: string;
    snapshotId: string | null;
    assessmentGoal: string | null;
    companyStage: string | null;
    generatedAt: string;
  };
};

export type DoctorInvestigationTemplate = {
  id: DoctorInvestigationTemplateId;
  title: string;
  businessQuestion: string;
  hypotheses: string[];
  requiredEvidence: DoctorEvidenceRequest[];
  applicableStages: CompanyLifecycleStage[];
  /** Higher = more important for that goal. */
  goalWeights: Partial<Record<AssessmentGoalId, number>>;
  basePriority: number;
  /** Dimension / risk keyword hints for observation matching. */
  signalKeywords: string[];
  highValueQuestion: string;
  recommendationTemplate: DoctorNextAction;
};
