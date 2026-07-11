/**
 * Evidence Coverage — diligence completeness by category for a company stage.
 * Distinct from health scoring: this answers "do we have the evidence?" first.
 */

import type {
  CompanyLifecycleStage,
  EvidenceExpectationLevel,
} from "./company-classification";
import type { EvidenceId } from "./primitives";

export type { EvidenceExpectationLevel };

export type EvidenceCoverageCategoryId =
  | "financial"
  | "governance"
  | "legal"
  | "customer"
  | "security"
  | "operations"
  | "people";

export type EvidenceCoverageItemId =
  // Financial
  | "historical-financial-statements"
  | "forecast"
  | "budget"
  | "cash-flow"
  | "customer-concentration-financial"
  | "debt-schedule"
  // Governance
  | "board-minutes"
  | "written-consents"
  | "bylaws"
  | "charter"
  | "option-approvals"
  // Legal
  | "incorporation"
  | "ip-assignments"
  | "employment-agreements"
  | "material-contracts"
  // Customer
  | "customer-list"
  | "arr"
  | "cohorts"
  | "churn"
  | "nrr"
  | "concentration"
  // Security
  | "security-policies"
  | "soc2"
  | "penetration-tests"
  | "mfa"
  | "dr-plan"
  // Operations
  | "org-chart"
  | "kpis"
  | "processes"
  // People
  | "compensation"
  | "hiring"
  | "retention"
  | "option-grants";

export type SupportingDocumentRef = {
  evidenceId: EvidenceId;
  title: string;
  documentId?: string | null;
  collectedAt: string;
};

export type EvidenceCoverageItemStatus = {
  itemId: EvidenceCoverageItemId;
  categoryId: EvidenceCoverageCategoryId;
  label: string;
  level: EvidenceExpectationLevel;
  uploaded: boolean;
  verified: boolean;
  confidence: number;
  lastUpdated: string | null;
  supportingDocuments: SupportingDocumentRef[];
  missing: boolean;
  whyItMatters: string;
};

export type EvidenceCoverageCategoryStatus = {
  categoryId: EvidenceCoverageCategoryId;
  label: string;
  items: EvidenceCoverageItemStatus[];
  requiredTotal: number;
  requiredComplete: number;
  recommendedTotal: number;
  recommendedComplete: number;
  coveragePct: number;
  missingRequired: EvidenceCoverageItemStatus[];
  missingRecommended: EvidenceCoverageItemStatus[];
};

export type EvidenceCoverageReport = {
  stage: CompanyLifecycleStage | null;
  generatedAt: string;
  categories: EvidenceCoverageCategoryStatus[];
  /** All applicable items (required + recommended + optional). */
  coveragePct: number;
  requiredCompletePct: number;
  recommendedCompletePct: number;
  missingRequired: EvidenceCoverageItemStatus[];
  missingRecommended: EvidenceCoverageItemStatus[];
  requiredTotal: number;
  requiredComplete: number;
  recommendedTotal: number;
  recommendedComplete: number;
  evidenceCount: number;
};
