import "./register";

export type { AssessmentGoalProvider } from "./provider";
export { isAssessmentGoalId, toGoalMeta } from "./provider";
export {
  getGoalProvider,
  listGoalMetas,
  listGoalProviders,
  registerGoalProvider,
  hasGoalProvider,
} from "./registry";
export {
  buildAssessmentGoalDashboardContext,
  ensureCompanyAssessmentGoal,
  getCompanyAssessmentGoal,
  loadAssessmentGoalDashboardContext,
  setCompanyAssessmentGoal,
} from "./persist";
export { ensureGoalProvidersRegistered } from "./register";
