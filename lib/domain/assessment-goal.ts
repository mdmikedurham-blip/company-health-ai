/**
 * Assessment Goal — Phase 3 domain types.
 * Goals change prioritization and presentation, never evidence storage.
 */

import type { CompanyId } from "./primitives";

export type AssessmentGoalId =
  | "run-the-company"
  | "raise-capital"
  | "sell-the-company"
  | "acquire-a-company"
  | "board-readiness"
  | "enterprise-sales"
  | "annual-audit"
  | "ipo-readiness";

export const ASSESSMENT_GOAL_IDS: AssessmentGoalId[] = [
  "run-the-company",
  "raise-capital",
  "sell-the-company",
  "acquire-a-company",
  "board-readiness",
  "enterprise-sales",
  "annual-audit",
  "ipo-readiness",
];

export const DEFAULT_ASSESSMENT_GOAL: AssessmentGoalId = "run-the-company";

export type CompanyAssessmentGoal = {
  companyId: CompanyId;
  goal: AssessmentGoalId;
  selectedBy: string | null;
  selectedAt: string;
  lastUpdated: string;
};

export type AssessmentGoalMeta = {
  id: AssessmentGoalId;
  label: string;
  purpose: string;
};

export type DimensionPriority = {
  dimensionId: string;
  weight: number;
  rationale: string;
};

export type RecommendationPriority = {
  theme: string;
  weight: number;
  rationale: string;
};

export type EvidencePriority = {
  categoryId: string;
  weight: number;
  rationale: string;
};

export type UploadPriority = {
  label: string;
  why: string;
  level: "required" | "recommended" | "optional";
};

export type DashboardWidgetSpec = {
  id: string;
  title: string;
  description: string;
  placeholder: boolean;
};

export type ReportingTemplateSpec = {
  id: string;
  title: string;
  sections: string[];
};

/** Run-the-company operating lenses (Protect / Grow / Operate / Prepare / Decide). */
export type OperatingLensId =
  | "protect"
  | "grow"
  | "operate"
  | "prepare"
  | "decide";

export type OperatingLens = {
  id: OperatingLensId;
  title: string;
  question: string;
  /** Placeholder — no AI output yet. */
  items: string[];
};

export type AssessmentGoalDashboardContext = {
  goal: AssessmentGoalId;
  label: string;
  purpose: string;
  selectedBy: string | null;
  selectedAt: string;
  lastUpdated: string;
  uploadPriorities: UploadPriority[];
  dashboardWidgets: DashboardWidgetSpec[];
  operatingLenses: OperatingLens[];
  availableGoals: AssessmentGoalMeta[];
};
