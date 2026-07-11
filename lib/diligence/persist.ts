/**
 * Persist / load question_answers (one current row per company+question).
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import { DILIGENCE_ANSWER_STATES } from "@/lib/domain/diligence-question";
import type { DiligenceAnswerState } from "@/lib/domain/diligence-question";

type AnswerRow = {
  company_id: string;
  snapshot_id: string | null;
  question_id: string;
  answer_state: string;
  confidence: number;
  supporting_evidence_ids: string[] | null;
  missing_evidence: string[] | null;
  reasoning: string;
  stage_level: string;
  effective_importance: number;
  last_updated: string;
};

function isAnswerState(value: string): value is DiligenceAnswerState {
  return (DILIGENCE_ANSWER_STATES as string[]).includes(value);
}

function rowToAnswer(row: AnswerRow): DiligenceQuestionAnswer {
  return {
    companyId: row.company_id,
    questionId: row.question_id,
    state: isAnswerState(row.answer_state) ? row.answer_state : "UNKNOWN",
    confidence: Number(row.confidence) || 0,
    supportingEvidenceIds: row.supporting_evidence_ids ?? [],
    missingEvidence: row.missing_evidence ?? [],
    reasoning: row.reasoning ?? "",
    lastUpdated: row.last_updated,
    snapshotId: row.snapshot_id,
    stageLevel:
      row.stage_level === "required" ||
      row.stage_level === "optional" ||
      row.stage_level === "not_applicable"
        ? row.stage_level
        : "optional",
    effectiveImportance: Number(row.effective_importance) || 1,
  };
}

export async function replaceCompanyQuestionAnswers(input: {
  client: AppSupabaseClient;
  companyId: string;
  answers: DiligenceQuestionAnswer[];
  snapshotId?: string | null;
}): Promise<void> {
  const { client, companyId, answers } = input;
  const { error: delError } = await client
    .from("question_answers")
    .delete()
    .eq("company_id", companyId);
  if (delError) {
    if (/does not exist|PGRST|schema cache/i.test(delError.message)) {
      return;
    }
    throw new Error(`replaceCompanyQuestionAnswers.delete: ${delError.message}`);
  }

  if (answers.length === 0) return;

  const rows = answers.map((a) => ({
    company_id: companyId,
    snapshot_id: input.snapshotId ?? a.snapshotId,
    question_id: a.questionId,
    answer_state: a.state,
    confidence: a.confidence,
    supporting_evidence_ids: a.supportingEvidenceIds,
    missing_evidence: a.missingEvidence,
    reasoning: a.reasoning,
    stage_level: a.stageLevel,
    effective_importance: a.effectiveImportance,
    last_updated: a.lastUpdated,
  }));

  const { error } = await client.from("question_answers").insert(rows);
  if (error) {
    throw new Error(`replaceCompanyQuestionAnswers.insert: ${error.message}`);
  }
}

export async function listCompanyQuestionAnswers(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<DiligenceQuestionAnswer[]> {
  const { data, error } = await input.client
    .from("question_answers")
    .select(
      "company_id, snapshot_id, question_id, answer_state, confidence, supporting_evidence_ids, missing_evidence, reasoning, stage_level, effective_importance, last_updated",
    )
    .eq("company_id", input.companyId);

  if (error) {
    if (/does not exist|PGRST|schema cache/i.test(error.message)) {
      return [];
    }
    throw new Error(`listCompanyQuestionAnswers: ${error.message}`);
  }
  return (data as AnswerRow[] | null)?.map(rowToAnswer) ?? [];
}
