/**
 * Stage × document-class evidence expectation matrix.
 * Levels: required | recommended | optional | not_applicable
 */

import type {
  CompanyLifecycleStage,
  DocumentClassId,
  EvidenceExpectationLevel,
  ExpectationItem,
} from "@/lib/domain/company-classification";

type MatrixCell = {
  level: EvidenceExpectationLevel;
  label: string;
  whyItMatters: string;
  dimensionId: string;
};

const DOC: Record<
  DocumentClassId,
  { label: string; why: string; dimensionId: string }
> = {
  "founder-docs": {
    label: "Founder / formation documents",
    why: "Establishes entity existence and ownership baseline.",
    dimensionId: "dim-governance",
  },
  "product-spec": {
    label: "Product / MVP documentation",
    why: "Shows product definition and readiness.",
    dimensionId: "dim-product",
  },
  "financial-model": {
    label: "Financial model / projections",
    why: "Supports runway and capital planning judgment.",
    dimensionId: "dim-financial",
  },
  "financial-statements": {
    label: "Financial statements / workbook",
    why: "Grounds revenue, cash, and burn in source numbers.",
    dimensionId: "dim-financial",
  },
  "customer-traction": {
    label: "Customer traction metrics",
    why: "Evidence of demand, retention, and concentration.",
    dimensionId: "dim-customer",
  },
  "customer-contracts": {
    label: "Customer contracts / MSAs",
    why: "Validates revenue quality and commercial terms.",
    dimensionId: "dim-customer",
  },
  "cap-table": {
    label: "Cap table",
    why: "Ownership, dilution, and investor structure.",
    dimensionId: "dim-governance",
  },
  "board-minutes": {
    label: "Board minutes / written consents",
    why: "Governance cadence and material approvals.",
    dimensionId: "dim-governance",
  },
  "employment-ip": {
    label: "Employment / IP assignment docs",
    why: "Protects IP ownership as the team grows.",
    dimensionId: "dim-legal",
  },
  "security-controls": {
    label: "Security controls / MFA evidence",
    why: "Shows security maturity appropriate to customer risk.",
    dimensionId: "dim-security",
  },
  "audit-report": {
    label: "Audit / SOC report",
    why: "Formal assurance expected at scale and enterprise sales.",
    dimensionId: "dim-security",
  },
  fundraising: {
    label: "Fundraising / investor docs",
    why: "Confirms outside capital and control expectations.",
    dimensionId: "dim-governance",
  },
};

type StageLevels = Record<DocumentClassId, EvidenceExpectationLevel>;

const STAGE_MATRIX: Record<CompanyLifecycleStage, StageLevels> = {
  Idea: {
    "founder-docs": "recommended",
    "product-spec": "optional",
    "financial-model": "optional",
    "financial-statements": "not_applicable",
    "customer-traction": "not_applicable",
    "customer-contracts": "not_applicable",
    "cap-table": "optional",
    "board-minutes": "not_applicable",
    "employment-ip": "optional",
    "security-controls": "optional",
    "audit-report": "not_applicable",
    fundraising: "optional",
  },
  "Pre-product / MVP": {
    "founder-docs": "recommended",
    "product-spec": "recommended",
    "financial-model": "recommended",
    "financial-statements": "optional",
    "customer-traction": "optional",
    "customer-contracts": "not_applicable",
    "cap-table": "optional",
    "board-minutes": "not_applicable",
    "employment-ip": "recommended",
    "security-controls": "optional",
    "audit-report": "not_applicable",
    fundraising: "optional",
  },
  "Early Revenue": {
    "founder-docs": "recommended",
    "product-spec": "recommended",
    "financial-model": "recommended",
    "financial-statements": "recommended",
    "customer-traction": "recommended",
    "customer-contracts": "optional",
    "cap-table": "recommended",
    "board-minutes": "optional",
    "employment-ip": "recommended",
    "security-controls": "recommended",
    "audit-report": "not_applicable",
    fundraising: "optional",
  },
  "Product-Market Fit": {
    "founder-docs": "recommended",
    "product-spec": "recommended",
    "financial-model": "recommended",
    "financial-statements": "required",
    "customer-traction": "required",
    "customer-contracts": "recommended",
    "cap-table": "recommended",
    "board-minutes": "recommended",
    "employment-ip": "required",
    "security-controls": "recommended",
    "audit-report": "optional",
    fundraising: "recommended",
  },
  Growth: {
    "founder-docs": "recommended",
    "product-spec": "optional",
    "financial-model": "required",
    "financial-statements": "required",
    "customer-traction": "required",
    "customer-contracts": "recommended",
    "cap-table": "required",
    "board-minutes": "required",
    "employment-ip": "required",
    "security-controls": "required",
    "audit-report": "recommended",
    fundraising: "recommended",
  },
  Scale: {
    "founder-docs": "optional",
    "product-spec": "optional",
    "financial-model": "required",
    "financial-statements": "required",
    "customer-traction": "required",
    "customer-contracts": "required",
    "cap-table": "required",
    "board-minutes": "required",
    "employment-ip": "required",
    "security-controls": "required",
    "audit-report": "required",
    fundraising: "recommended",
  },
  "Exit Ready": {
    "founder-docs": "recommended",
    "product-spec": "optional",
    "financial-model": "required",
    "financial-statements": "required",
    "customer-traction": "required",
    "customer-contracts": "required",
    "cap-table": "required",
    "board-minutes": "required",
    "employment-ip": "required",
    "security-controls": "required",
    "audit-report": "required",
    fundraising: "required",
  },
};

/** Dimensions typically relevant by stage (others → Not applicable). */
export const STAGE_RELEVANT_DIMENSIONS: Record<
  CompanyLifecycleStage,
  string[]
> = {
  Idea: ["dim-product", "dim-people", "dim-governance", "dim-legal"],
  "Pre-product / MVP": [
    "dim-product",
    "dim-people",
    "dim-governance",
    "dim-legal",
    "dim-financial",
  ],
  "Early Revenue": [
    "dim-financial",
    "dim-customer",
    "dim-revenue-quality",
    "dim-product",
    "dim-people",
    "dim-governance",
    "dim-legal",
    "dim-security",
  ],
  "Product-Market Fit": [
    "dim-financial",
    "dim-customer",
    "dim-revenue-quality",
    "dim-product",
    "dim-people",
    "dim-governance",
    "dim-legal",
    "dim-security",
    "dim-operations",
  ],
  Growth: [
    "dim-financial",
    "dim-customer",
    "dim-revenue-quality",
    "dim-governance",
    "dim-legal",
    "dim-security",
    "dim-people",
    "dim-operations",
    "dim-product",
  ],
  Scale: [
    "dim-financial",
    "dim-customer",
    "dim-revenue-quality",
    "dim-governance",
    "dim-legal",
    "dim-security",
    "dim-people",
    "dim-operations",
    "dim-product",
    "dim-ai-readiness",
  ],
  "Exit Ready": [
    "dim-financial",
    "dim-customer",
    "dim-revenue-quality",
    "dim-governance",
    "dim-legal",
    "dim-security",
    "dim-people",
    "dim-operations",
    "dim-product",
    "dim-ai-readiness",
  ],
};

export function expectationsForStage(
  stage: CompanyLifecycleStage,
): ExpectationItem[] {
  const levels = STAGE_MATRIX[stage];
  return (Object.keys(levels) as DocumentClassId[]).map((documentClass) => {
    const meta = DOC[documentClass];
    return {
      documentClass,
      dimensionId: meta.dimensionId,
      level: levels[documentClass],
      label: meta.label,
      whyItMatters: meta.why,
    };
  });
}

export function isDimensionRelevantForStage(
  stage: CompanyLifecycleStage | null | undefined,
  dimensionId: string,
): boolean {
  if (!stage) return true; // until classified, do not mark N/A
  return STAGE_RELEVANT_DIMENSIONS[stage].includes(dimensionId);
}

export function toMatrixCell(
  stage: CompanyLifecycleStage,
  documentClass: DocumentClassId,
): MatrixCell {
  const meta = DOC[documentClass];
  return {
    level: STAGE_MATRIX[stage][documentClass],
    label: meta.label,
    whyItMatters: meta.why,
    dimensionId: meta.dimensionId,
  };
}
