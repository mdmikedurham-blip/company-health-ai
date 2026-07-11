import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type { Evidence } from "@/lib/domain";
import type { DiligenceQuestionBundle } from "@/lib/domain/diligence-question";
import {
  answerDiligenceQuestions,
  prioritizeQuestionIds,
} from "./answer-engine";
import { DILIGENCE_CATALOG_VERSION, DILIGENCE_QUESTION_CATALOG } from "./catalog";
import { computeQuestionCoverage } from "./coverage";

export function buildDiligenceBundle(input: {
  companyId: string;
  evidence: Evidence[];
  stage?: CompanyLifecycleStage | null;
  assessmentGoal?: AssessmentGoalId | null;
  snapshotId?: string | null;
  asOf?: string;
}): DiligenceQuestionBundle {
  const { answers } = answerDiligenceQuestions(input);
  const coverage = computeQuestionCoverage({
    companyId: input.companyId,
    answers,
    snapshotId: input.snapshotId,
    generatedAt: input.asOf,
  });
  return {
    catalogVersion: DILIGENCE_CATALOG_VERSION,
    questions: DILIGENCE_QUESTION_CATALOG,
    answers,
    coverage,
    prioritizedQuestionIds: prioritizeQuestionIds(
      answers,
      input.assessmentGoal,
    ),
  };
}
