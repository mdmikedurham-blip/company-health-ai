export { isDemoModeEnabled, isDemoCompanyId, DEMO_COMPANY_ID } from "./demo-mode";
export type {
  DashboardDataSource,
  DashboardMetric,
  DashboardProvenance,
  TenantDashboardView,
} from "./types";
export {
  buildDashboardMetrics,
  emptyTenantDashboard,
  loadDemoDashboardView,
  loadTenantDashboard,
} from "./load-tenant-dashboard";
export { loadAuthenticatedDashboardView } from "./load-authenticated-view";
export {
  buildDimensionCoverage,
  isLegacyBaselineOnlySnapshot,
  sanitizeHealthAssessment,
} from "./sanitize-health";
