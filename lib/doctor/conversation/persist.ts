/**
 * Persist / load doctor_conversations and doctor_investigations.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  DoctorConversation,
  DoctorConversationTurn,
  DoctorEvidenceRequest,
  DoctorInvestigation,
  DoctorLearnedItem,
  DoctorNextAction,
} from "@/lib/domain/doctor-conversation";

type ConversationRow = {
  id: string;
  company_id: string;
  snapshot_id: string | null;
  assessment_goal: string | null;
  company_stage: string | null;
  status: string;
  current_topic: string | null;
  current_investigation_id: string | null;
  current_hypothesis: string | null;
  confidence: number | string;
  unanswered_questions: unknown;
  requested_evidence: unknown;
  completed_investigation_ids: string[] | null;
  conversation_history: unknown;
  recently_learned: unknown;
  top_observation: string | null;
  next_action: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InvestigationRow = {
  id: string;
  conversation_id: string;
  company_id: string;
  template_id: string;
  title: string;
  business_question: string;
  hypotheses: unknown;
  required_evidence: unknown;
  confidence: number | string;
  blocking_unknowns: unknown;
  status: string;
  priority: number | string;
  current_question: string | null;
  evidence_request: unknown;
  recommendation: unknown;
  explainability: unknown;
  snapshot_id: string | null;
  opened_at: string;
  completed_at: string | null;
  updated_at: string;
  observation?: string | null;
  primary_hypothesis?: string | null;
  alternative_hypotheses?: unknown;
  supporting_fact_keys?: string[] | null;
  supporting_evidence_ids?: string[] | null;
  materiality?: number | string | null;
  expected_business_impact?: string | null;
  estimated_confidence_gain?: number | string | null;
  estimated_value_impact?: unknown;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function rowToConversation(row: ConversationRow): DoctorConversation {
  return {
    id: row.id,
    companyId: row.company_id,
    snapshotId: row.snapshot_id,
    assessmentGoal: row.assessment_goal,
    companyStage: row.company_stage,
    status: row.status as DoctorConversation["status"],
    currentTopic: row.current_topic,
    currentInvestigationId: row.current_investigation_id,
    currentHypothesis: row.current_hypothesis,
    confidence: Number(row.confidence) || 0,
    unansweredQuestions: asArray<string>(row.unanswered_questions),
    requestedEvidence: asArray<DoctorEvidenceRequest>(row.requested_evidence),
    completedInvestigationIds: row.completed_investigation_ids ?? [],
    conversationHistory: asArray<DoctorConversationTurn>(
      row.conversation_history,
    ),
    recentlyLearned: asArray<DoctorLearnedItem>(row.recently_learned),
    topObservation: row.top_observation,
    nextAction: (row.next_action as DoctorNextAction | null) ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInvestigation(row: InvestigationRow): DoctorInvestigation {
  const hypotheses = asArray<string>(row.hypotheses);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    companyId: row.company_id,
    templateId: row.template_id,
    title: row.title,
    businessQuestion: row.business_question,
    observation: row.observation ?? null,
    primaryHypothesis:
      row.primary_hypothesis ?? hypotheses[0] ?? null,
    alternativeHypotheses:
      asArray<string>(row.alternative_hypotheses).length > 0
        ? asArray<string>(row.alternative_hypotheses)
        : hypotheses.slice(1),
    hypotheses,
    requiredEvidence: asArray<DoctorEvidenceRequest>(row.required_evidence),
    supportingFactKeys: row.supporting_fact_keys ?? [],
    supportingEvidenceIds: row.supporting_evidence_ids ?? [],
    confidence: Number(row.confidence) || 0,
    materiality:
      row.materiality == null ? null : Number(row.materiality) || null,
    expectedBusinessImpact: row.expected_business_impact ?? null,
    blockingUnknowns: asArray<string>(row.blocking_unknowns),
    status: row.status as DoctorInvestigation["status"],
    priority: Number(row.priority) || 0,
    currentQuestion: row.current_question,
    evidenceRequest:
      (row.evidence_request as DoctorEvidenceRequest | null) ?? null,
    recommendation: (row.recommendation as DoctorNextAction | null) ?? null,
    estimatedConfidenceGain:
      row.estimated_confidence_gain == null
        ? null
        : Number(row.estimated_confidence_gain) || null,
    estimatedValueImpact:
      (row.estimated_value_impact as DoctorInvestigation["estimatedValueImpact"]) ??
      null,
    explainability: {
      findingIds: [],
      questionIds: [],
      evidenceIds: [],
      documentIds: [],
      ...((row.explainability as object) ?? {}),
    },
    snapshotId: row.snapshot_id,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function isMissingTableError(message: string): boolean {
  return /does not exist|PGRST|schema cache/i.test(message);
}

export async function getActiveDoctorConversation(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<DoctorConversation | null> {
  const { data, error } = await input.client
    .from("doctor_conversations")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) return null;
    throw new Error(`getActiveDoctorConversation: ${error.message}`);
  }
  if (!data) return null;
  return rowToConversation(data as ConversationRow);
}

export async function upsertActiveDoctorConversation(input: {
  client: AppSupabaseClient;
  conversation: DoctorConversation;
}): Promise<DoctorConversation> {
  const c = input.conversation;
  const payload = {
    id: c.id,
    company_id: c.companyId,
    snapshot_id: c.snapshotId,
    assessment_goal: c.assessmentGoal,
    company_stage: c.companyStage,
    status: c.status,
    current_topic: c.currentTopic,
    current_investigation_id: c.currentInvestigationId,
    current_hypothesis: c.currentHypothesis,
    confidence: c.confidence,
    unanswered_questions: c.unansweredQuestions,
    requested_evidence: c.requestedEvidence,
    completed_investigation_ids: c.completedInvestigationIds,
    conversation_history: c.conversationHistory,
    recently_learned: c.recentlyLearned,
    top_observation: c.topObservation,
    next_action: c.nextAction,
    created_by: c.createdBy,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await input.client
    .from("doctor_conversations")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`upsertActiveDoctorConversation: ${error.message}`);
  }
  return rowToConversation(data as ConversationRow);
}

export async function listDoctorInvestigations(input: {
  client: AppSupabaseClient;
  companyId: string;
  conversationId: string;
}): Promise<DoctorInvestigation[]> {
  const { data, error } = await input.client
    .from("doctor_investigations")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("conversation_id", input.conversationId)
    .order("priority", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(`listDoctorInvestigations: ${error.message}`);
  }
  return (data as InvestigationRow[]).map(rowToInvestigation);
}

export async function upsertDoctorInvestigation(input: {
  client: AppSupabaseClient;
  investigation: DoctorInvestigation;
}): Promise<DoctorInvestigation> {
  const i = input.investigation;
  const payload = {
    id: i.id,
    conversation_id: i.conversationId,
    company_id: i.companyId,
    template_id: i.templateId,
    title: i.title,
    business_question: i.businessQuestion,
    hypotheses: i.hypotheses,
    required_evidence: i.requiredEvidence,
    confidence: i.confidence,
    blocking_unknowns: i.blockingUnknowns,
    status: i.status,
    priority: i.priority,
    current_question: i.currentQuestion,
    evidence_request: i.evidenceRequest,
    recommendation: i.recommendation,
    explainability: i.explainability,
    snapshot_id: i.snapshotId,
    opened_at: i.openedAt,
    completed_at: i.completedAt,
    updated_at: new Date().toISOString(),
  };

  // Phase 11 investigation fields are enriched in-memory each cycle.
  // Persist them only after migration 022 is reflected in generated DB types.
  const { data, error } = await input.client
    .from("doctor_investigations")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`upsertDoctorInvestigation: ${error.message}`);
  }
  const persisted = rowToInvestigation(data as InvestigationRow);
  return {
    ...persisted,
    observation: i.observation,
    primaryHypothesis: i.primaryHypothesis,
    alternativeHypotheses: i.alternativeHypotheses,
    supportingFactKeys: i.supportingFactKeys,
    supportingEvidenceIds: i.supportingEvidenceIds,
    materiality: i.materiality,
    expectedBusinessImpact: i.expectedBusinessImpact,
    estimatedConfidenceGain: i.estimatedConfidenceGain,
    estimatedValueImpact: i.estimatedValueImpact,
  };
}
