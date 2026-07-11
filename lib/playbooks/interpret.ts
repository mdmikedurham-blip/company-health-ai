/**
 * Build playbook interpretation views from shared evidence/answers.
 * Does not mutate evidence; reorders and narrates only.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  PlaybookDashboardContext,
  PlaybookId,
  PlaybookInterpretationContext,
} from "@/lib/domain/playbook";
import { DEFAULT_PLAYBOOK, PLAYBOOK_ENGINE_VERSION } from "@/lib/domain/playbook";
import { isPlaybookId } from "./provider";
import { getPlaybookProvider } from "./registry";
import "./register";

export function resolvePlaybookId(
  goalOrPlaybook?: AssessmentGoalId | PlaybookId | string | null,
): PlaybookId {
  if (goalOrPlaybook && isPlaybookId(goalOrPlaybook)) {
    return goalOrPlaybook;
  }
  return DEFAULT_PLAYBOOK;
}

export function buildPlaybookInterpretationContext(
  input: Omit<PlaybookInterpretationContext, "playbookId"> & {
    playbookId?: PlaybookId | null;
    assessmentGoal?: AssessmentGoalId | null;
  },
): PlaybookInterpretationContext {
  return {
    companyId: input.companyId,
    playbookId: resolvePlaybookId(input.playbookId ?? input.assessmentGoal),
    answers: input.answers,
    recommendations: input.recommendations,
    risks: input.risks,
    healthScore: input.healthScore,
    coverage: input.coverage,
    presentEvidenceTypes: input.presentEvidenceTypes,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * Full playbook dashboard/API payload for the current operating mode.
 */
export function interpretWithPlaybook(
  input: Omit<PlaybookInterpretationContext, "playbookId"> & {
    playbookId?: PlaybookId | null;
    assessmentGoal?: AssessmentGoalId | null;
  },
): PlaybookDashboardContext {
  const context = buildPlaybookInterpretationContext(input);
  const provider = getPlaybookProvider(context.playbookId);

  const prioritizedQuestionIds = provider.prioritizeQuestions(context.answers);
  const prioritizedRecs = provider.prioritizeRecommendations(
    context.recommendations,
  );
  const uploadPriorities = provider.prioritizeUploads(context);
  const missingEvidence = provider.generateMissingEvidence(context);
  const readiness = provider.generateReadiness({
    ...context,
    recommendations: prioritizedRecs,
  });
  const executiveSummary = provider.generateExecutiveSummary({
    ...context,
    recommendations: prioritizedRecs,
  });

  return {
    playbookId: provider.id,
    label: provider.label,
    objective: provider.objective,
    playbookVersion: provider.playbookVersion || PLAYBOOK_ENGINE_VERSION,
    successCriteria: provider.successCriteria,
    focusAreas: provider.focusAreas,
    reportSections: provider.getReportSections(),
    readiness,
    executiveSummary,
    uploadPriorities,
    missingEvidence,
    prioritizedQuestionIds,
    prioritizedRecommendationIds: prioritizedRecs.map((r) => r.id),
  };
}

/**
 * Reorder recommendations for a playbook without rebuilding full context.
 */
export function prioritizeRecommendationsForPlaybook(
  playbookId: PlaybookId | null | undefined,
  recommendations: PlaybookInterpretationContext["recommendations"],
) {
  return getPlaybookProvider(resolvePlaybookId(playbookId)).prioritizeRecommendations(
    recommendations,
  );
}
