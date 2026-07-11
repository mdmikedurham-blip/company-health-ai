/**
 * Canonical Business Concept ontology + fact→concept mapping.
 * Never invent concepts outside this catalog.
 */

import type {
  BusinessConceptDefinition,
  BusinessConceptId,
} from "@/lib/domain/business-concept";

export const BUSINESS_CONCEPT_CATALOG_VERSION = "business-concepts-v1";

export const BUSINESS_CONCEPT_CATALOG: BusinessConceptDefinition[] = [
  {
    id: "financial-performance",
    label: "Financial Performance",
    description: "Revenue, growth, margins, and operating earnings.",
    factKeys: [
      "revenue",
      "revenueGrowth",
      "revenueGrowthRate",
      "grossMargin",
      "ebitda",
      "operatingIncome",
    ],
    dimensionId: "dim-financial",
  },
  {
    id: "cash-management",
    label: "Cash Management",
    description: "Cash balance, burn, runway, and debt liquidity.",
    factKeys: [
      "cashBalance",
      "burnRateMonthly",
      "cashRunwayMonths",
      "debt",
    ],
    contradictingFactSignals: ["cashRunwayMonths"],
    dimensionId: "dim-financial",
  },
  {
    id: "revenue-quality",
    label: "Revenue Quality",
    description: "Retention, churn, and durability of revenue.",
    factKeys: [
      "netRevenueRetention",
      "churnRate",
      "logoChurnRate",
      "revenueChurnRate",
    ],
    contradictingFactSignals: ["netRevenueRetention"],
    dimensionId: "dim-customer",
  },
  {
    id: "customer-concentration",
    label: "Customer Concentration",
    description: "Dependence on a small set of customers for ARR.",
    factKeys: ["top3CustomerArrShare"],
    contradictingFactSignals: ["top3CustomerArrShare"],
    dimensionId: "dim-customer",
  },
  {
    id: "recurring-revenue",
    label: "Recurring Revenue",
    description: "Share of revenue that is recurring / contractual.",
    factKeys: ["recurringRevenueShare"],
    dimensionId: "dim-financial",
  },
  {
    id: "governance",
    label: "Governance",
    description: "Overall governance hygiene and documented cadence.",
    factKeys: [
      "governanceCadenceDocumented",
      "governanceCadenceAppropriate",
      "corporateActionsDocumented",
      "governanceFactsComplete",
    ],
    dimensionId: "dim-governance",
  },
  {
    id: "board-oversight",
    label: "Board Oversight",
    description: "Board meetings, cadence, and director oversight.",
    factKeys: [
      "boardMeetingDate",
      "boardMeetingsLast12Months",
      "directorElectionsDocumented",
      "governanceCadenceDocumented",
    ],
    dimensionId: "dim-governance",
  },
  {
    id: "corporate-approvals",
    label: "Corporate Approvals",
    description: "Board approvals and written consents for material actions.",
    factKeys: [
      "boardApprovalsDocumented",
      "writtenConsentDocumented",
      "optionGrantsMissingBoardApproval",
      "materialActionsMissingBoardApproval",
      "financingApprovalsDocumented",
    ],
    contradictingFactSignals: [
      "optionGrantsMissingBoardApproval",
      "materialActionsMissingBoardApproval",
    ],
    dimensionId: "dim-governance",
  },
  {
    id: "capital-structure",
    label: "Capital Structure",
    description: "Cap table currency and capitalization clarity.",
    factKeys: ["capTableCurrent", "capTablePresent", "debt"],
    dimensionId: "dim-governance",
  },
  {
    id: "equity-management",
    label: "Equity Management",
    description: "Option grants and equity issuance approvals.",
    factKeys: [
      "optionGrantsApproved",
      "optionGrantsMissingBoardApproval",
      "equityIssuancesApproved",
    ],
    contradictingFactSignals: ["optionGrantsMissingBoardApproval"],
    dimensionId: "dim-governance",
  },
  {
    id: "legal-structure",
    label: "Legal Structure",
    description: "Entity and contractual legal foundation.",
    factKeys: [
      "customerContractsOnFile",
      "materialCustomerContractsCount",
      "corporateActionsDocumented",
    ],
    dimensionId: "dim-legal",
  },
  {
    id: "intellectual-property",
    label: "Intellectual Property",
    description: "IP assignment completeness for employees and contractors.",
    factKeys: [
      "agreementsMissingIpAssignment",
      "ipAssignmentsComplete",
      "totalContractorAgreements",
    ],
    contradictingFactSignals: ["agreementsMissingIpAssignment"],
    dimensionId: "dim-legal",
  },
  {
    id: "employment",
    label: "Employment",
    description: "Employment and contractor agreement coverage.",
    factKeys: [
      "employmentAgreementsPresent",
      "totalContractorAgreements",
    ],
    dimensionId: "dim-legal",
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Control and audit readiness signals.",
    factKeys: [
      "financialControlsPresent",
      "governanceFactsComplete",
      "securityPoliciesDocumented",
    ],
    dimensionId: "dim-governance",
  },
  {
    id: "security-program",
    label: "Security Program",
    description: "Policies, incident response, controls, and MFA.",
    factKeys: [
      "securityPoliciesDocumented",
      "incidentResponsePlanPresent",
      "openCriticalControls",
      "mfaCoverage",
    ],
    contradictingFactSignals: ["openCriticalControls", "mfaCoverage"],
    dimensionId: "dim-security",
  },
  {
    id: "operational-excellence",
    label: "Operational Excellence",
    description: "KPI monitoring, process ownership, and financial controls.",
    factKeys: [
      "kpiMonitoringPresent",
      "operatingMetricsTracked",
      "criticalProcessesOwned",
      "financialControlsPresent",
    ],
    dimensionId: "dim-operations",
  },
  {
    id: "people",
    label: "People",
    description: "Attrition, org clarity, and workforce health.",
    factKeys: [
      "voluntaryAttritionRate",
      "orgChartPresent",
      "organizationalOwnershipClear",
      "headcount",
    ],
    dimensionId: "dim-people",
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Key-person risk and leadership continuity.",
    factKeys: [
      "singleOwnerCriticalFunctions",
      "keyPersonRisksIdentified",
    ],
    contradictingFactSignals: ["singleOwnerCriticalFunctions"],
    dimensionId: "dim-people",
  },
  {
    id: "sales-execution",
    label: "Sales Execution",
    description: "Commercial traction and customer contract execution.",
    factKeys: [
      "customerContractsOnFile",
      "materialCustomerContractsCount",
      "top3CustomerArrShare",
      "revenueGrowth",
      "revenueGrowthRate",
    ],
    dimensionId: "dim-customer",
  },
  {
    id: "product-execution",
    label: "Product Execution",
    description: "Product delivery and roadmap execution signals.",
    factKeys: ["featuresOnTrack", "aiCopilotBetaDate"],
    dimensionId: "dim-product",
  },
  {
    id: "strategic-planning",
    label: "Strategic Planning",
    description: "Planning artifacts and forward-looking operating metrics.",
    factKeys: [
      "kpiMonitoringPresent",
      "operatingMetricsTracked",
      "financialFactsComplete",
    ],
    dimensionId: "dim-operations",
  },
  {
    id: "risk-management",
    label: "Risk Management",
    description: "Cross-cutting risk controls spanning security, cash, and key person.",
    factKeys: [
      "openCriticalControls",
      "cashRunwayMonths",
      "singleOwnerCriticalFunctions",
      "incidentResponsePlanPresent",
    ],
    contradictingFactSignals: [
      "openCriticalControls",
      "cashRunwayMonths",
      "singleOwnerCriticalFunctions",
    ],
    dimensionId: "dim-security",
  },
];

/** Normalize extractor aliases onto a canonical fact key. */
export const FACT_KEY_ALIASES: Record<string, string> = {
  revenueGrowthRate: "revenueGrowth",
  churnRate: "logoChurnRate",
};

export function canonicalFactKey(key: string): string {
  return FACT_KEY_ALIASES[key] ?? key;
}

export function getConceptDefinition(
  conceptId: string,
): BusinessConceptDefinition | undefined {
  return BUSINESS_CONCEPT_CATALOG.find((c) => c.id === conceptId);
}

export function isBusinessConceptId(value: string): value is BusinessConceptId {
  return BUSINESS_CONCEPT_CATALOG.some((c) => c.id === value);
}

/** Reverse index: fact key → concept ids that consume it. */
export function conceptsForFactKey(factKey: string): BusinessConceptId[] {
  const canonical = canonicalFactKey(factKey);
  const ids: BusinessConceptId[] = [];
  for (const concept of BUSINESS_CONCEPT_CATALOG) {
    const keys = concept.factKeys.map(canonicalFactKey);
    if (keys.includes(canonical) || concept.factKeys.includes(factKey)) {
      ids.push(concept.id);
    }
  }
  return ids;
}
