import { definePlaybook } from "../base";

export const ipoReadinessPlaybook = definePlaybook({
  id: "ipo-readiness",
  label: "IPO Readiness",
  objective:
    "Track public-company readiness: controls, governance, audit, compliance, and financial reporting.",
  successCriteria: [
    "Financial reporting and controls are IPO-grade",
    "Governance cadence and board practices are mature",
    "Security and compliance evidence is sustained",
    "Audit readiness is continuous, not episodic",
  ],
  focusAreas: [
    "Controls",
    "Governance",
    "Audit",
    "Compliance",
    "Financial reporting",
  ],
  dimensionPriorities: [
    { dimensionId: "dim-governance", weight: 1, rationale: "Public-company board practices." },
    { dimensionId: "dim-financial", weight: 0.95, rationale: "Reporting quality." },
    { dimensionId: "dim-operations", weight: 0.9, rationale: "Control environment." },
    { dimensionId: "dim-security", weight: 0.85, rationale: "Compliance posture." },
    { dimensionId: "dim-legal", weight: 0.8, rationale: "Disclosure readiness." },
  ],
  questionPriorities: [
    { questionId: "q-ops-financial-controls", weight: 1.5, rationale: "SOX-adjacent controls." },
    { questionId: "q-gov-cadence", weight: 1.4, rationale: "Board maturity." },
    { questionId: "q-gov-board-approvals", weight: 1.35, rationale: "Formal authority." },
    { questionId: "q-sec-policies", weight: 1.3, rationale: "Compliance baseline." },
    { questionId: "q-sec-critical-controls", weight: 1.25, rationale: "Control proof." },
    { questionId: "q-gov-cap-table", weight: 1.2, rationale: "Capitalization clarity." },
    { questionId: "q-fin-revenue-growing", weight: 1.15, rationale: "Reporting story." },
    { questionId: "q-legal-customer-contracts", weight: 1.1, rationale: "Disclosure risk." },
  ],
  requiredEvidence: [
    {
      evidenceType: "financial_controls",
      label: "Financial controls",
      why: "Public-company control baseline.",
      level: "required",
    },
    {
      evidenceType: "board_minutes",
      label: "Board governance pack",
      why: "Governance maturity evidence.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "financial_statements",
      label: "Financial reporting package",
      why: "IPO financial narrative.",
      level: "recommended",
    },
    {
      evidenceType: "security_policies",
      label: "Compliance / security policies",
      why: "Sustained compliance posture.",
      level: "recommended",
    },
    {
      evidenceType: "soc2",
      label: "SOC 2 / assurance reports",
      why: "External control assurance.",
      level: "recommended",
    },
  ],
  reportSections: [
    "IPO readiness",
    "Controls",
    "Governance",
    "Audit & compliance",
    "Financial reporting",
    "Open gaps",
    "Next uploads",
  ],
  recommendationOrdering: [
    { theme: "control", weight: 1.4, rationale: "IPO controls." },
    { theme: "governance", weight: 1.35, rationale: "Board maturity." },
    { theme: "audit", weight: 1.3, rationale: "Assurance path." },
    { theme: "compliance", weight: 1.25, rationale: "Ongoing posture." },
    { theme: "reporting", weight: 1.2, rationale: "Financial narrative." },
  ],
  recommendationDimensionWeights: {
    "dim-governance": 1.35,
    "dim-operations": 1.3,
    "dim-financial": 1.25,
    "dim-security": 1.2,
  },
  uploadCatalog: [
    {
      id: "upload-ipo-controls",
      label: "Financial controls documentation",
      why: "Core IPO control readiness.",
      level: "required",
      evidenceTypes: ["financial_controls"],
    },
    {
      id: "upload-ipo-governance",
      label: "Board governance pack",
      why: "Public-company board practices.",
      level: "required",
      evidenceTypes: ["board_minutes"],
    },
    {
      id: "upload-ipo-assurance",
      label: "SOC 2 / assurance reports",
      why: "External compliance evidence.",
      level: "recommended",
      evidenceTypes: ["soc2"],
    },
  ],
  reportingTemplate: {
    id: "ipo-readiness",
    title: "IPO readiness brief",
    sections: [
      "IPO readiness",
      "Controls",
      "Governance",
      "Audit & compliance",
      "Financial reporting",
      "Open gaps",
    ],
  },
});
