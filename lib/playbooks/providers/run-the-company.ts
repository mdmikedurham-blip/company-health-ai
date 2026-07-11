import { definePlaybook } from "../base";

/** Run the Company — Protect / Grow / Operate / Prepare / Decide. */
export const runTheCompanyPlaybook = definePlaybook({
  id: "run-the-company",
  label: "Run the Company",
  objective:
    "Protect continuity, remove growth constraints, and prioritize highest operational impact.",
  successCriteria: [
    "Cash runway and burn are current and understood",
    "Customer concentration and retention risks are visible",
    "Operating KPIs and ownership are clear",
    "Material decisions have an evidence trail",
  ],
  focusAreas: ["Protect", "Grow", "Operate", "Prepare", "Decide"],
  dimensionPriorities: [
    { dimensionId: "dim-financial", weight: 1, rationale: "Cash protects continuity." },
    { dimensionId: "dim-customer", weight: 0.9, rationale: "Retention bounds growth risk." },
    { dimensionId: "dim-people", weight: 0.85, rationale: "Execution capacity." },
    { dimensionId: "dim-operations", weight: 0.8, rationale: "Internal efficiency." },
    { dimensionId: "dim-governance", weight: 0.7, rationale: "Decision hygiene." },
  ],
  questionPriorities: [
    { questionId: "q-fin-runway-sufficient", weight: 1.5, rationale: "Protect cash." },
    { questionId: "q-fin-fund-operations", weight: 1.4, rationale: "Funding capacity." },
    { questionId: "q-ops-kpi-monitoring", weight: 1.4, rationale: "Operate with signal." },
    { questionId: "q-cust-concentration", weight: 1.3, rationale: "Protect revenue base." },
    { questionId: "q-cust-churn", weight: 1.2, rationale: "Grow sustainably." },
    { questionId: "q-ops-process-ownership", weight: 1.2, rationale: "Reduce drag." },
    { questionId: "q-people-key-person", weight: 1.2, rationale: "Key-person risk." },
    { questionId: "q-people-org-clarity", weight: 1.1, rationale: "Ownership clarity." },
    { questionId: "q-gov-board-approvals", weight: 1.0, rationale: "Prepare milestones." },
  ],
  requiredEvidence: [
    {
      evidenceType: "cash_runway",
      label: "Cash runway workbook",
      why: "Operating decisions need a hard floor.",
      level: "required",
    },
    {
      evidenceType: "financial_statements",
      label: "Financial statements",
      why: "Ground Protect and Operate lenses.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "arr_snapshot",
      label: "Customer / ARR snapshot",
      why: "Supports Grow and concentration checks.",
      level: "recommended",
    },
    {
      evidenceType: "revenue_growth",
      label: "Financial forecast",
      why: "Forward operating plan.",
      level: "recommended",
    },
    {
      evidenceType: "org_chart",
      label: "Product roadmap / org clarity",
      why: "Clarifies ownership and next milestone prep.",
      level: "recommended",
    },
  ],
  reportSections: [
    "Protect",
    "Grow",
    "Operate",
    "Prepare",
    "Decide",
    "Evidence coverage",
    "Next actions",
  ],
  recommendationOrdering: [
    { theme: "protect", weight: 1.35, rationale: "Operational downside first." },
    { theme: "runway", weight: 1.3, rationale: "Cash continuity." },
    { theme: "grow", weight: 1.15, rationale: "Remove growth constraints." },
    { theme: "operate", weight: 1.1, rationale: "Reduce internal drag." },
    { theme: "prepare", weight: 1.0, rationale: "Milestone readiness." },
  ],
  recommendationDimensionWeights: {
    "dim-financial": 1.25,
    "dim-customer": 1.15,
    "dim-operations": 1.1,
    "dim-people": 1.05,
  },
  uploadCatalog: [
    {
      id: "upload-customer-metrics",
      label: "Customer metrics",
      why: "Grounds Grow and concentration risk.",
      level: "required",
      evidenceTypes: ["arr_snapshot", "revenue_growth"],
    },
    {
      id: "upload-financial-forecast",
      label: "Financial forecast",
      why: "Supports Protect and Operate planning.",
      level: "required",
      evidenceTypes: ["cash_runway", "financial_statements"],
    },
    {
      id: "upload-product-roadmap",
      label: "Product roadmap",
      why: "Clarifies Prepare / Decide priorities.",
      level: "recommended",
      evidenceTypes: ["org_chart"],
    },
  ],
  reportingTemplate: {
    id: "run-the-company-ops",
    title: "Operating health brief",
    sections: [
      "Protect",
      "Grow",
      "Operate",
      "Prepare",
      "Decide",
      "Evidence coverage",
      "Next actions",
    ],
  },
});
