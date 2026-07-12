/**
 * Company Factory — schemas (Phase 9).
 * Independent of Insight Engine output.
 */

export const SYNTHETIC_DATA_CLASS = "factory-corpus" as const;
export const SYNTHETIC_ID_PREFIX = "synthetic-" as const;

export type FactoryLifecycleStage =
  | "Idea"
  | "Pre-product / MVP"
  | "Early Revenue"
  | "Product-Market Fit"
  | "Growth"
  | "Scale"
  | "Exit Ready"
  | "Distressed";

export type FactoryIndustry =
  | "B2B SaaS"
  | "Marketplace"
  | "Professional services"
  | "Manufacturing"
  | "Healthcare technology";

export type ArtifactQuality = "strong" | "average" | "weak";

export type ScenarioId =
  | "healthy"
  | "average"
  | "distressed"
  | "high_customer_concentration"
  | "declining_revenue"
  | "cash_runway_risk"
  | "weak_governance"
  | "missing_ip_assignments"
  | "security_gaps"
  | "excessive_hiring"
  | "stalled_product_execution"
  | "founder_dependency"
  | "aggressive_forecast"
  | "poor_retention"
  | "board_approval_gaps";

export type CanonicalCompanyProfile = {
  synthetic: true;
  dataClass: typeof SYNTHETIC_DATA_CLASS;
  companyId: string;
  companyName: string;
  industry: FactoryIndustry;
  businessModel: string;
  revenueModel: string;
  lifecycleStage: FactoryLifecycleStage;
  jurisdiction: string;
  entityType: string;
  foundingDate: string;
  annualRevenue: number;
  arr: number;
  growthRate: number;
  grossMargin: number;
  ebitda: number;
  cash: number;
  monthlyBurn: number;
  debt: number;
  cashRunwayMonths: number;
  employeeCount: number;
  customerCount: number;
  top3CustomerArrShare: number;
  churnRate: number;
  nrr: number;
  recurringRevenueShare: number;
  fundingHistory: Array<{ round: string; amount: number; date: string }>;
  capTableSummary: string;
  boardStructure: {
    chair: string;
    directors: string[];
    meetingCadence: string;
  };
  auditStatus: string;
  securityMaturity: "basic" | "growing" | "formal" | "enterprise";
  strategy: string;
  majorRisks: string[];
  knownMissingControls: string[];
  seed: number;
};

export type ScenarioConfig = {
  synthetic: true;
  dataClass: typeof SYNTHETIC_DATA_CLASS;
  companyId: string;
  seed: number;
  primary: ScenarioId;
  flags: ScenarioId[];
};

export type ArtifactRecord = {
  id: string;
  category: string;
  title: string;
  relativePath: string;
  mimeType: string;
  quality: ArtifactQuality;
  format: "xlsx" | "csv" | "txt" | "pdf" | "docx" | "pptx";
  binds: string[];
};

export type ArtifactManifest = {
  synthetic: true;
  dataClass: typeof SYNTHETIC_DATA_CLASS;
  companyId: string;
  seed: number;
  generatedAt: string;
  artifacts: ArtifactRecord[];
};

export type RangeExpectation = {
  available: boolean;
  expectedRange?: [number, number];
  confidenceRange?: [number, number];
  reason?: string;
};

export type GoldenTruth = {
  synthetic: true;
  dataClass: typeof SYNTHETIC_DATA_CLASS;
  companyId: string;
  seed: number;
  lifecycleStage: FactoryLifecycleStage;
  assessmentGoal: string;
  classification: {
    industry: FactoryIndustry;
    stage: FactoryLifecycleStage;
  };
  financialHealth: RangeExpectation;
  governance: RangeExpectation;
  expectedRisks: Array<{
    id: string;
    titleContains: string[];
    severity: "high" | "medium" | "low";
  }>;
  expectedRecommendations: Array<{
    id: string;
    titleContains: string[];
  }>;
  expectedCoverage: {
    minDocuments: number;
    requiredCategories: string[];
  };
  missingEvidence: string[];
  nextBestUpload: string;
  doctor: {
    firstObservationContains: string[];
    firstQuestionContains: string[];
  };
  expectedFinancialFacts: string[];
  playbookReadiness: {
    minCoveragePercent: number;
    expectedBand: "ready" | "partial" | "not_ready";
  };
  notes: string[];
};

export type GeneratedCompanyBundle = {
  profile: CanonicalCompanyProfile;
  scenario: ScenarioConfig;
  manifest: ArtifactManifest;
  golden: GoldenTruth;
  files: Map<string, Uint8Array | string>;
};
