/**
 * Stage-aware catalog of diligence evidence categories and items.
 */

import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  EvidenceCoverageCategoryId,
  EvidenceCoverageItemId,
  EvidenceExpectationLevel,
} from "@/lib/domain/evidence-coverage";

export type CoverageItemDef = {
  itemId: EvidenceCoverageItemId;
  categoryId: EvidenceCoverageCategoryId;
  label: string;
  whyItMatters: string;
};

export type CoverageCategoryDef = {
  categoryId: EvidenceCoverageCategoryId;
  label: string;
  items: CoverageItemDef[];
};

export const EVIDENCE_COVERAGE_CATEGORIES: CoverageCategoryDef[] = [
  {
    categoryId: "financial",
    label: "Financial",
    items: [
      {
        itemId: "historical-financial-statements",
        categoryId: "financial",
        label: "Historical financial statements",
        whyItMatters:
          "Grounds revenue, cash, and burn in source numbers for diligence.",
      },
      {
        itemId: "forecast",
        categoryId: "financial",
        label: "Forecast",
        whyItMatters: "Shows forward planning and capital trajectory.",
      },
      {
        itemId: "budget",
        categoryId: "financial",
        label: "Budget",
        whyItMatters: "Tests operating discipline against plan.",
      },
      {
        itemId: "cash-flow",
        categoryId: "financial",
        label: "Cash flow",
        whyItMatters: "Clarifies runway and liquidity risk.",
      },
      {
        itemId: "customer-concentration-financial",
        categoryId: "financial",
        label: "Customer concentration",
        whyItMatters: "Flags revenue dependency risk in the financials.",
      },
      {
        itemId: "debt-schedule",
        categoryId: "financial",
        label: "Debt schedule",
        whyItMatters: "Surfaces leverage, covenants, and repayment risk.",
      },
    ],
  },
  {
    categoryId: "governance",
    label: "Governance",
    items: [
      {
        itemId: "board-minutes",
        categoryId: "governance",
        label: "Board minutes",
        whyItMatters: "Shows board cadence and material decision-making.",
      },
      {
        itemId: "written-consents",
        categoryId: "governance",
        label: "Written consents",
        whyItMatters: "Documents approvals taken outside formal meetings.",
      },
      {
        itemId: "bylaws",
        categoryId: "governance",
        label: "Bylaws",
        whyItMatters: "Defines corporate governance rules and authority.",
      },
      {
        itemId: "charter",
        categoryId: "governance",
        label: "Charter",
        whyItMatters: "Confirms authorized equity and corporate structure.",
      },
      {
        itemId: "option-approvals",
        categoryId: "governance",
        label: "Option approvals",
        whyItMatters: "Validates equity grants were properly authorized.",
      },
    ],
  },
  {
    categoryId: "legal",
    label: "Legal",
    items: [
      {
        itemId: "incorporation",
        categoryId: "legal",
        label: "Incorporation",
        whyItMatters: "Establishes entity existence and jurisdiction.",
      },
      {
        itemId: "ip-assignments",
        categoryId: "legal",
        label: "IP assignments",
        whyItMatters: "Protects company ownership of core IP.",
      },
      {
        itemId: "employment-agreements",
        categoryId: "legal",
        label: "Employment agreements",
        whyItMatters: "Confirms key hire terms and restrictive covenants.",
      },
      {
        itemId: "material-contracts",
        categoryId: "legal",
        label: "Material contracts",
        whyItMatters: "Surfaces commercial obligations and change-of-control risk.",
      },
    ],
  },
  {
    categoryId: "customer",
    label: "Customer",
    items: [
      {
        itemId: "customer-list",
        categoryId: "customer",
        label: "Customer list",
        whyItMatters: "Shows who buys and how concentrated the book is.",
      },
      {
        itemId: "arr",
        categoryId: "customer",
        label: "ARR",
        whyItMatters: "Anchors recurring revenue scale.",
      },
      {
        itemId: "cohorts",
        categoryId: "customer",
        label: "Cohorts",
        whyItMatters: "Reveals retention patterns over time.",
      },
      {
        itemId: "churn",
        categoryId: "customer",
        label: "Churn",
        whyItMatters: "Quantifies revenue leakage and product-market fit risk.",
      },
      {
        itemId: "nrr",
        categoryId: "customer",
        label: "NRR",
        whyItMatters: "Measures expansion vs contraction in the base.",
      },
      {
        itemId: "concentration",
        categoryId: "customer",
        label: "Concentration",
        whyItMatters: "Highlights customer dependency risk.",
      },
    ],
  },
  {
    categoryId: "security",
    label: "Security",
    items: [
      {
        itemId: "security-policies",
        categoryId: "security",
        label: "Policies",
        whyItMatters: "Shows baseline security posture and accountability.",
      },
      {
        itemId: "soc2",
        categoryId: "security",
        label: "SOC 2",
        whyItMatters: "Formal assurance expected for enterprise sales.",
      },
      {
        itemId: "penetration-tests",
        categoryId: "security",
        label: "Penetration tests",
        whyItMatters: "Independent validation of control effectiveness.",
      },
      {
        itemId: "mfa",
        categoryId: "security",
        label: "MFA",
        whyItMatters: "Core identity control against account takeover.",
      },
      {
        itemId: "dr-plan",
        categoryId: "security",
        label: "DR plan",
        whyItMatters: "Preparedness for outage and continuity risk.",
      },
    ],
  },
  {
    categoryId: "operations",
    label: "Operations",
    items: [
      {
        itemId: "org-chart",
        categoryId: "operations",
        label: "Org chart",
        whyItMatters: "Clarifies ownership and operating structure.",
      },
      {
        itemId: "kpis",
        categoryId: "operations",
        label: "KPIs",
        whyItMatters: "Shows how the business is managed day to day.",
      },
      {
        itemId: "processes",
        categoryId: "operations",
        label: "Processes",
        whyItMatters: "Evidence that critical work is repeatable.",
      },
    ],
  },
  {
    categoryId: "people",
    label: "People",
    items: [
      {
        itemId: "compensation",
        categoryId: "people",
        label: "Compensation",
        whyItMatters: "Tests pay equity and cost structure.",
      },
      {
        itemId: "hiring",
        categoryId: "people",
        label: "Hiring",
        whyItMatters: "Shows growth capacity and role coverage.",
      },
      {
        itemId: "retention",
        categoryId: "people",
        label: "Retention",
        whyItMatters: "Flags attrition risk in critical roles.",
      },
      {
        itemId: "option-grants",
        categoryId: "people",
        label: "Option grants",
        whyItMatters: "Confirms equity incentives for key talent.",
      },
    ],
  },
];

/** Default levels when a stage has no explicit override (all optional). */
type StageLevels = Partial<Record<EvidenceCoverageItemId, EvidenceExpectationLevel>>;

/**
 * Stage × item expectation matrix.
 * Items omitted default to optional for Early Revenue+, not_applicable for Idea.
 */
const STAGE_OVERRIDES: Record<CompanyLifecycleStage, StageLevels> = {
  Idea: {
    incorporation: "recommended",
    "ip-assignments": "optional",
    "employment-agreements": "optional",
    forecast: "optional",
    "board-minutes": "not_applicable",
    "written-consents": "not_applicable",
    "historical-financial-statements": "not_applicable",
    arr: "not_applicable",
    churn: "not_applicable",
    nrr: "not_applicable",
    soc2: "not_applicable",
    "penetration-tests": "not_applicable",
    "debt-schedule": "not_applicable",
    "material-contracts": "not_applicable",
  },
  "Pre-product / MVP": {
    incorporation: "required",
    "ip-assignments": "recommended",
    "employment-agreements": "recommended",
    forecast: "recommended",
    budget: "optional",
    "cash-flow": "optional",
    "historical-financial-statements": "optional",
    "board-minutes": "not_applicable",
    "written-consents": "optional",
    bylaws: "recommended",
    charter: "recommended",
    "security-policies": "optional",
    mfa: "optional",
    "org-chart": "optional",
    hiring: "optional",
    "option-grants": "optional",
    arr: "not_applicable",
    cohorts: "not_applicable",
    churn: "not_applicable",
    nrr: "not_applicable",
    concentration: "not_applicable",
    soc2: "not_applicable",
    "penetration-tests": "not_applicable",
    "debt-schedule": "not_applicable",
  },
  "Early Revenue": {
    incorporation: "required",
    "ip-assignments": "required",
    "employment-agreements": "recommended",
    "historical-financial-statements": "recommended",
    forecast: "recommended",
    budget: "recommended",
    "cash-flow": "recommended",
    "customer-list": "recommended",
    arr: "recommended",
    concentration: "optional",
    bylaws: "recommended",
    charter: "recommended",
    "board-minutes": "optional",
    "written-consents": "optional",
    "security-policies": "recommended",
    mfa: "recommended",
    "org-chart": "recommended",
    kpis: "optional",
    compensation: "optional",
    hiring: "recommended",
    "option-grants": "optional",
    soc2: "not_applicable",
    "penetration-tests": "optional",
    "debt-schedule": "optional",
  },
  "Product-Market Fit": {
    incorporation: "required",
    "ip-assignments": "required",
    "employment-agreements": "required",
    "material-contracts": "recommended",
    "historical-financial-statements": "required",
    forecast: "required",
    budget: "recommended",
    "cash-flow": "required",
    "customer-concentration-financial": "recommended",
    "customer-list": "required",
    arr: "required",
    cohorts: "recommended",
    churn: "recommended",
    nrr: "recommended",
    concentration: "recommended",
    "board-minutes": "recommended",
    "written-consents": "recommended",
    bylaws: "required",
    charter: "required",
    "option-approvals": "recommended",
    "security-policies": "required",
    mfa: "required",
    "dr-plan": "recommended",
    "penetration-tests": "recommended",
    soc2: "optional",
    "org-chart": "required",
    kpis: "recommended",
    processes: "recommended",
    compensation: "recommended",
    hiring: "recommended",
    retention: "recommended",
    "option-grants": "recommended",
    "debt-schedule": "optional",
  },
  Growth: {
    incorporation: "required",
    "ip-assignments": "required",
    "employment-agreements": "required",
    "material-contracts": "required",
    "historical-financial-statements": "required",
    forecast: "required",
    budget: "required",
    "cash-flow": "required",
    "customer-concentration-financial": "required",
    "debt-schedule": "recommended",
    "customer-list": "required",
    arr: "required",
    cohorts: "required",
    churn: "required",
    nrr: "required",
    concentration: "required",
    "board-minutes": "required",
    "written-consents": "required",
    bylaws: "required",
    charter: "required",
    "option-approvals": "required",
    "security-policies": "required",
    mfa: "required",
    "dr-plan": "required",
    "penetration-tests": "required",
    soc2: "recommended",
    "org-chart": "required",
    kpis: "required",
    processes: "required",
    compensation: "required",
    hiring: "required",
    retention: "required",
    "option-grants": "required",
  },
  Scale: {
    incorporation: "required",
    "ip-assignments": "required",
    "employment-agreements": "required",
    "material-contracts": "required",
    "historical-financial-statements": "required",
    forecast: "required",
    budget: "required",
    "cash-flow": "required",
    "customer-concentration-financial": "required",
    "debt-schedule": "required",
    "customer-list": "required",
    arr: "required",
    cohorts: "required",
    churn: "required",
    nrr: "required",
    concentration: "required",
    "board-minutes": "required",
    "written-consents": "required",
    bylaws: "required",
    charter: "required",
    "option-approvals": "required",
    "security-policies": "required",
    mfa: "required",
    "dr-plan": "required",
    "penetration-tests": "required",
    soc2: "required",
    "org-chart": "required",
    kpis: "required",
    processes: "required",
    compensation: "required",
    hiring: "required",
    retention: "required",
    "option-grants": "required",
  },
  "Exit Ready": {
    incorporation: "required",
    "ip-assignments": "required",
    "employment-agreements": "required",
    "material-contracts": "required",
    "historical-financial-statements": "required",
    forecast: "required",
    budget: "required",
    "cash-flow": "required",
    "customer-concentration-financial": "required",
    "debt-schedule": "required",
    "customer-list": "required",
    arr: "required",
    cohorts: "required",
    churn: "required",
    nrr: "required",
    concentration: "required",
    "board-minutes": "required",
    "written-consents": "required",
    bylaws: "required",
    charter: "required",
    "option-approvals": "required",
    "security-policies": "required",
    mfa: "required",
    "dr-plan": "required",
    "penetration-tests": "required",
    soc2: "required",
    "org-chart": "required",
    kpis: "required",
    processes: "required",
    compensation: "required",
    hiring: "required",
    retention: "required",
    "option-grants": "required",
  },
};

function defaultLevelForStage(
  stage: CompanyLifecycleStage | null,
): EvidenceExpectationLevel {
  if (!stage || stage === "Idea") return "not_applicable";
  return "optional";
}

export function expectationLevelForItem(
  stage: CompanyLifecycleStage | null,
  itemId: EvidenceCoverageItemId,
): EvidenceExpectationLevel {
  if (!stage) return "optional";
  const override = STAGE_OVERRIDES[stage]?.[itemId];
  if (override) return override;
  return defaultLevelForStage(stage);
}

export function allCoverageItems(): CoverageItemDef[] {
  return EVIDENCE_COVERAGE_CATEGORIES.flatMap((c) => c.items);
}
