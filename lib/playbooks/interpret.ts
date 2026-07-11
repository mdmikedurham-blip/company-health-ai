/**
 * Build playbook interpretation views from one Assessment Snapshot.
 * Does not mutate evidence; reorders and narrates only.
 * Changing assessment goal recomputes priorities/readiness only.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  PlaybookDashboardContext,
  PlaybookId,
  PlaybookInterpretationContext,
} from "@/lib/domain/playbook";
import {
  DEFAULT_PLAYBOOK,
  PLAYBOOK_ENGINE_VERSION,
} from "@/lib/domain/playbook";
import type { AssessmentSnapshotPack } from "@/lib/domain/assessment-snapshot";
import { computeQuestionCoverage } from "@/lib/diligence/coverage";
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
    snapshotId: input.snapshotId ?? null,
    companyStage: input.companyStage ?? null,
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
 * All intelligence inputs must come from one snapshot (or empty).
 */
export function interpretWithPlaybook(
  input: Omit<PlaybookInterpretationContext, "playbookId"> & {
    playbookId?: PlaybookId | null;
    assessmentGoal?: AssessmentGoalId | null;
  },
): PlaybookDashboardContext {
  const context = buildPlaybookInterpretationContext(input);
  const provider = getPlaybookProvider(context.playbookId);

  const prioritizedQuestionIds = provider.prioritizeQuestions(
    context.answers,
    context.companyStage,
  );
  const prioritizedRecs = provider.prioritizeRecommendations(
    context.recommendations,
  );
  const uploadPriorities = provider.prioritizeUploads(context);
  const missingEvidence = provider.generateMissingEvidence(context);
  const readiness = provider.calculateReadiness({
    ...context,
    recommendations: prioritizedRecs,
  });
  const executiveSummary = provider.buildExecutiveSummaryContext({
    ...context,
    recommendations: prioritizedRecs,
  });
  const reportSections = provider.buildReportSections(context);

  return {
    playbookId: provider.id,
    name: provider.name,
    label: provider.label,
    objective: provider.objective,
    playbookVersion: provider.playbookVersion || PLAYBOOK_ENGINE_VERSION,
    successCriteria: provider.successCriteria,
    focusAreas: provider.focusAreas,
    applicableLifecycleStages: provider.applicableLifecycleStages,
    reportSections,
    readiness,
    executiveSummary,
    uploadPriorities,
    missingEvidence,
    prioritizedQuestionIds,
    prioritizedRecommendationIds: prioritizedRecs.map((r) => r.id),
    criticalBlockers: readiness.criticalBlockers,
    provenance: {
      companyId: context.companyId,
      snapshotId: context.snapshotId,
      playbookId: provider.id,
      playbookVersion: provider.playbookVersion || PLAYBOOK_ENGINE_VERSION,
      assessmentGoal: provider.id,
      companyStage: context.companyStage,
      generatedAt: context.generatedAt ?? new Date().toISOString(),
    },
  };
}

/**
 * Interpret a published snapshot pack under the live assessment goal/playbook.
 * Evidence and answers stay on the snapshot; only interpretation changes.
 */
export function interpretSnapshotWithPlaybook(input: {
  companyId: string;
  pack: AssessmentSnapshotPack;
  assessmentGoal?: AssessmentGoalId | PlaybookId | null;
  presentEvidenceTypes?: string[];
}): PlaybookDashboardContext {
  const stage =
    (input.pack.companyStage as CompanyLifecycleStage | null) ?? null;
  const coverage =
    input.pack.questionCoverage ??
    (input.pack.questionAnswers.length > 0
      ? computeQuestionCoverage({
          companyId: input.companyId,
          answers: input.pack.questionAnswers,
          snapshotId: input.pack.snapshotId,
        })
      : null);

  return interpretWithPlaybook({
    companyId: input.companyId,
    assessmentGoal: resolvePlaybookId(
      input.assessmentGoal ?? input.pack.assessmentGoal,
    ),
    snapshotId: input.pack.snapshotId,
    companyStage: stage,
    answers: input.pack.questionAnswers,
    recommendations: input.pack.recommendations,
    risks: input.pack.risks,
    healthScore: input.pack.healthScore,
    coverage,
    presentEvidenceTypes: input.presentEvidenceTypes ?? [],
    generatedAt: new Date().toISOString(),
  });
}

export function prioritizeRecommendationsForPlaybook(
  playbookId: PlaybookId | null | undefined,
  recommendations: PlaybookInterpretationContext["recommendations"],
) {
  return getPlaybookProvider(
    resolvePlaybookId(playbookId),
  ).prioritizeRecommendations(recommendations);
}
