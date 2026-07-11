import { definePlaybook } from "../base";

export const boardReadinessPlaybook = definePlaybook({
  id: "board-readiness",
  label: "Board Readiness",
  objective:
    "Focus on governance cadence, approvals, board-pack completeness, and decision hygiene.",
  successCriteria: [
    "Board meeting cadence is evidenced",
    "Material approvals are documented",
    "Cap table and equity actions are current",
    "Board pack inputs are complete enough to decide",
  ],
  focusAreas: [
    "Governance cadence",
    "Approvals",
    "Board pack",
    "Cap table",
    "Decision evidence",
  ],
  dimensionPriorities: [
    { dimensionId: "dim-governance", weight: 1, rationale: "Board operating system." },
    { dimensionId: "dim-financial", weight: 0.85, rationale: "Board numbers." },
    { dimensionId: "dim-legal", weight: 0.8, rationale: "Authority and filings." },
    { dimensionId: "dim-operations", weight: 0.7, rationale: "KPI pack." },
  ],
  questionPriorities: [
    { questionId: "q-gov-cadence", weight: 1.5, rationale: "Meeting rhythm." },
    { questionId: "q-gov-board-approvals", weight: 1.45, rationale: "Authority trail." },
    { questionId: "q-gov-cap-table", weight: 1.35, rationale: "Ownership for board." },
    { questionId: "q-gov-equity-issuances", weight: 1.3, rationale: "Equity actions." },
    { questionId: "q-ops-kpi-monitoring", weight: 1.2, rationale: "Board KPIs." },
    { questionId: "q-fin-fund-operations", weight: 1.15, rationale: "Cash for board." },
    { questionId: "q-people-org-clarity", weight: 1.1, rationale: "Leadership clarity." },
  ],
  requiredEvidence: [
    {
      evidenceType: "board_minutes",
      label: "Board minutes / packs",
      why: "Cadence and approvals evidence.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "cap_table",
      label: "Cap table",
      why: "Equity clarity for the board.",
      level: "recommended",
    },
    {
      evidenceType: "financial_statements",
      label: "Board financials",
      why: "Numbers for decisions.",
      level: "recommended",
    },
  ],
  reportSections: [
    "Board readiness",
    "Cadence & approvals",
    "Cap table & equity",
    "Board pack gaps",
    "Decisions lacking evidence",
    "Next uploads",
  ],
  recommendationOrdering: [
    { theme: "board", weight: 1.4, rationale: "Governance first." },
    { theme: "approval", weight: 1.35, rationale: "Authority trail." },
    { theme: "cap table", weight: 1.25, rationale: "Ownership hygiene." },
    { theme: "kpi", weight: 1.15, rationale: "Decision inputs." },
  ],
  recommendationDimensionWeights: {
    "dim-governance": 1.4,
    "dim-financial": 1.1,
    "dim-legal": 1.1,
  },
  uploadCatalog: [
    {
      id: "upload-board-minutes",
      label: "Board minutes",
      why: "Prove cadence and approvals.",
      level: "required",
      evidenceTypes: ["board_minutes"],
    },
    {
      id: "upload-board-pack",
      label: "Latest board pack",
      why: "Completeness for the next meeting.",
      level: "required",
      evidenceTypes: ["board_minutes", "financial_statements"],
    },
    {
      id: "upload-cap-table-board",
      label: "Cap table",
      why: "Equity clarity for directors.",
      level: "recommended",
      evidenceTypes: ["cap_table"],
    },
  ],
  reportingTemplate: {
    id: "board-readiness",
    title: "Board readiness brief",
    sections: [
      "Board readiness",
      "Cadence & approvals",
      "Cap table & equity",
      "Board pack gaps",
      "Decisions lacking evidence",
    ],
  },
});
