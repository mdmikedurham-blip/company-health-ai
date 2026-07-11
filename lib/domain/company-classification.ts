/**
 * Company Classification — Phase 1 types.
 * Stage-aware due diligence profile inferred from persisted evidence,
 * with separate user-confirmed overrides.
 */

import type { CompanyId, EvidenceId } from "./primitives";

export type CompanyLifecycleStage =
  | "Idea"
  | "Pre-product / MVP"
  | "Early Revenue"
  | "Product-Market Fit"
  | "Growth"
  | "Scale"
  | "Exit Ready";

export const COMPANY_LIFECYCLE_STAGES: CompanyLifecycleStage[] = [
  "Idea",
  "Pre-product / MVP",
  "Early Revenue",
  "Product-Market Fit",
  "Growth",
  "Scale",
  "Exit Ready",
];

export type RevenueRange =
  | "none"
  | "pre-revenue"
  | "under-1m"
  | "1m-10m"
  | "10m-plus"
  | "unknown";

export type EmployeeCountRange =
  | "1-5"
  | "6-20"
  | "21-50"
  | "51-200"
  | "200-plus"
  | "unknown";

export type CustomerCountRange =
  | "none"
  | "1-10"
  | "11-50"
  | "51-200"
  | "200-plus"
  | "unknown";

export type FundingStatus =
  | "bootstrapped"
  | "friends-family"
  | "pre-seed"
  | "seed"
  | "series-a-plus"
  | "unknown";

export type SecurityMaturityExpected =
  | "basic"
  | "growing"
  | "formal"
  | "enterprise";

export type ProfileFieldOrigin = "inferred" | "user-confirmed";

export type ProfileFieldProvenance = {
  value: string | number | boolean | null;
  evidenceIds: EvidenceId[];
  extractionSource: string;
  confidence: number;
  origin: ProfileFieldOrigin;
  updatedAt: string;
};

export type ClassificationAssumption = {
  field: string;
  statement: string;
  requiresConfirmation: boolean;
};

export type EvidenceExpectationLevel =
  | "required"
  | "recommended"
  | "optional"
  | "not_applicable";

export type DocumentClassId =
  | "founder-docs"
  | "product-spec"
  | "financial-model"
  | "financial-statements"
  | "customer-traction"
  | "customer-contracts"
  | "cap-table"
  | "board-minutes"
  | "employment-ip"
  | "security-controls"
  | "audit-report"
  | "fundraising";

export type ExpectationItem = {
  documentClass: DocumentClassId;
  dimensionId: string;
  level: EvidenceExpectationLevel;
  label: string;
  whyItMatters: string;
};

export type InferredClassificationFields = {
  stage: CompanyLifecycleStage | null;
  industry: string | null;
  businessModel: string | null;
  revenueModel: string | null;
  annualRevenueRange: RevenueRange;
  employeeCountRange: EmployeeCountRange;
  customerCountRange: CustomerCountRange;
  fundingStatus: FundingStatus;
  outsideInvestors: boolean | null;
  jurisdictionEntityType: string | null;
  boardRequired: boolean | null;
  boardPresent: boolean | null;
  auditExpected: boolean | null;
  securityMaturityExpected: SecurityMaturityExpected | null;
};

/** User-confirmable subset — never overwritten by re-inference. */
export type ConfirmedClassificationOverrides = Partial<{
  stage: CompanyLifecycleStage;
  annualRevenueRange: RevenueRange;
  employeeCountRange: EmployeeCountRange;
  boardPresent: boolean;
  fundingStatus: FundingStatus;
}>;

export type CompanyClassification = {
  id: string;
  companyId: CompanyId;
  snapshotId: string | null;
  /** Effective values after applying confirmed overrides. */
  stage: CompanyLifecycleStage | null;
  industry: string | null;
  businessModel: string | null;
  revenueModel: string | null;
  annualRevenueRange: RevenueRange;
  employeeCountRange: EmployeeCountRange;
  customerCountRange: CustomerCountRange;
  fundingStatus: FundingStatus;
  outsideInvestors: boolean | null;
  jurisdictionEntityType: string | null;
  boardRequired: boolean | null;
  boardPresent: boolean | null;
  auditExpected: boolean | null;
  securityMaturityExpected: SecurityMaturityExpected | null;
  confidence: number;
  sourceEvidenceIds: EvidenceId[];
  generatedAt: string;
  fieldProvenance: Record<string, ProfileFieldProvenance>;
  inferred: InferredClassificationFields;
  inferenceRationale: string;
  assumptions: ClassificationAssumption[];
  confirmed: ConfirmedClassificationOverrides;
  confirmedAt: string | null;
  confirmedBy: string | null;
  evidenceCoveragePct: number;
  dimensionCoverage: Record<string, number>;
  missingRequired: ExpectationItem[];
  missingRecommended: ExpectationItem[];
  optionalRemaining: ExpectationItem[];
  healthScoreAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassificationCoverageReport = {
  evidenceCoveragePct: number;
  dimensionCoverage: Record<string, number>;
  classificationConfidence: number;
  healthScoreAvailable: boolean;
  missingRequired: ExpectationItem[];
  missingRecommended: ExpectationItem[];
  optionalRemaining: ExpectationItem[];
  classifying: boolean;
};
