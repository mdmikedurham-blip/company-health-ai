/**
 * AssessmentGoalProvider — strategy interface for every assessment goal.
 * Consumers resolve providers via the registry, never by switch/case on goal id.
 */

import type {
  AssessmentGoalId,
  AssessmentGoalMeta,
  DashboardWidgetSpec,
  DimensionPriority,
  EvidencePriority,
  OperatingLens,
  RecommendationPriority,
  ReportingTemplateSpec,
  UploadPriority,
} from "@/lib/domain/assessment-goal";

export type AssessmentGoalProvider = AssessmentGoalMeta & {
  getDimensionPriorities(): DimensionPriority[];
  getRecommendationPriorities(): RecommendationPriority[];
  getEvidencePriorities(): EvidencePriority[];
  getDashboardWidgets(): DashboardWidgetSpec[];
  getUploadPriorities(): UploadPriority[];
  getReportingTemplate(): ReportingTemplateSpec;
  /** Optional — Run the Company operating lenses. */
  getOperatingLenses?(): OperatingLens[];
};

export function toGoalMeta(provider: AssessmentGoalProvider): AssessmentGoalMeta {
  return {
    id: provider.id,
    label: provider.label,
    purpose: provider.purpose,
  };
}

export function isAssessmentGoalId(
  value: string,
): value is AssessmentGoalId {
  return (
    value === "run-the-company" ||
    value === "raise-capital" ||
    value === "sell-the-company" ||
    value === "acquire-a-company" ||
    value === "board-readiness" ||
    value === "enterprise-sales" ||
    value === "annual-audit" ||
    value === "ipo-readiness"
  );
}
