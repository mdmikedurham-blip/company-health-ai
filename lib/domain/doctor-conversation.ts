/**
 * Company Doctor Conversation Engine — Phase 8 domain types.
 * Mentor workflow: Observe → Diagnose → Ask ONE → Request ONE evidence → Recommend ONE.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { CompanyLifecycleStage } from "./company-classification";
import type { CompanyId } from "./primitives";

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
  hypotheses: string[];
  requiredEvidence: DoctorEvidenceRequest[];
  confidence: number;
  blockingUnknowns: string[];
  status: DoctorInvestigationStatus;
  priority: number;
  currentQuestion: string | null;
  evidenceRequest: DoctorEvidenceRequest | null;
  recommendation: DoctorNextAction | null;
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
  nextRecommendedAction: DoctorNextAction | null;
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
