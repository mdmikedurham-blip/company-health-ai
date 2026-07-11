import { definePlaybook } from "../base";

export const acquireACompanyPlaybook = definePlaybook({
  id: "acquire-a-company",
  label: "Acquire a Company",
  objective:
    "Structure buy-side diligence: target financials, legal exposure, customers, and integration risk.",
  successCriteria: [
    "Target financial quality is evidence-backed",
    "Legal and IP exposure is scoped",
    "Customer concentration and contracts are understood",
    "Integration / people risks are flagged",
  ],
  focusAreas: [
    "Target financials",
    "Legal exposure",
    "Customer durability",
    "People & integration",
    "Risk inventory",
  ],
  dimensionPriorities: [
    { dimensionId: "dim-financial", weight: 1, rationale: "Valuation and QoE." },
    { dimensionId: "dim-legal", weight: 0.95, rationale: "Hidden liabilities." },
    { dimensionId: "dim-customer", weight: 0.9, rationale: "Revenue durability." },
    { dimensionId: "dim-people", weight: 0.85, rationale: "Integration risk." },
    { dimensionId: "dim-governance", weight: 0.8, rationale: "Authority and controls." },
  ],
  questionPriorities: [
    { questionId: "q-fin-fund-operations", weight: 1.4, rationale: "Target continuity." },
    { questionId: "q-fin-recurring-healthy", weight: 1.35, rationale: "Revenue quality." },
    { questionId: "q-legal-customer-contracts", weight: 1.35, rationale: "Transfer risk." },
    { questionId: "q-legal-ip-assignments", weight: 1.3, rationale: "Asset ownership." },
    { questionId: "q-cust-concentration", weight: 1.25, rationale: "Deal risk." },
    { questionId: "q-people-key-person", weight: 1.25, rationale: "Integration." },
    { questionId: "q-ops-financial-controls", weight: 1.2, rationale: "Control environment." },
    { questionId: "q-gov-board-approvals", weight: 1.1, rationale: "Deal authority." },
  ],
  requiredEvidence: [
    {
      evidenceType: "financial_statements",
      label: "Target financials",
      why: "Buy-side QoE baseline.",
      level: "required",
    },
    {
      evidenceType: "customer_contracts",
      label: "Customer contracts",
      why: "Revenue transferability.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "ip_assignments",
      label: "IP documentation",
      why: "Asset diligence.",
      level: "recommended",
    },
    {
      evidenceType: "org_chart",
      label: "Org / key person map",
      why: "Integration planning.",
      level: "recommended",
    },
  ],
  reportSections: [
    "Acquisition thesis",
    "Financial quality",
    "Legal & IP",
    "Customers",
    "People & integration",
    "Risk inventory",
    "Open diligence",
  ],
  recommendationOrdering: [
    { theme: "financial", weight: 1.3, rationale: "Valuation risk." },
    { theme: "legal", weight: 1.3, rationale: "Liability risk." },
    { theme: "customer", weight: 1.2, rationale: "Revenue durability." },
    { theme: "people", weight: 1.15, rationale: "Integration." },
  ],
  recommendationDimensionWeights: {
    "dim-financial": 1.3,
    "dim-legal": 1.3,
    "dim-customer": 1.2,
    "dim-people": 1.15,
  },
  uploadCatalog: [
    {
      id: "upload-target-financials",
      label: "Target financial statements",
      why: "Buy-side QoE.",
      level: "required",
      evidenceTypes: ["financial_statements"],
    },
    {
      id: "upload-target-contracts",
      label: "Customer contract inventory",
      why: "Revenue diligence.",
      level: "required",
      evidenceTypes: ["customer_contracts"],
    },
    {
      id: "upload-target-ip",
      label: "IP / assignment pack",
      why: "Asset ownership checks.",
      level: "recommended",
      evidenceTypes: ["ip_assignments"],
    },
  ],
  reportingTemplate: {
    id: "buy-side-diligence",
    title: "Buy-side diligence brief",
    sections: [
      "Acquisition thesis",
      "Financial quality",
      "Legal & IP",
      "Customers",
      "People & integration",
      "Risk inventory",
    ],
  },
});
