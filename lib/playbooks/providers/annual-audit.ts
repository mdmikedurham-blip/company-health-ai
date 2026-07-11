import { definePlaybook } from "../base";

export const annualAuditPlaybook = definePlaybook({
  id: "annual-audit",
  label: "Annual Audit",
  objective:
    "Align evidence collection with audit readiness, controls documentation, and financial reporting.",
  successCriteria: [
    "Financial statements are complete and reconcilable",
    "Financial controls evidence is available",
    "Employment and legal agreements support control testing",
    "Open audit PBC items are tracked",
  ],
  focusAreas: [
    "Financial reporting",
    "Controls",
    "PBC readiness",
    "Legal support",
  ],
  dimensionPriorities: [
    { dimensionId: "dim-financial", weight: 1, rationale: "Reporting package." },
    { dimensionId: "dim-operations", weight: 0.95, rationale: "Control environment." },
    { dimensionId: "dim-legal", weight: 0.85, rationale: "Support agreements." },
    { dimensionId: "dim-governance", weight: 0.8, rationale: "Oversight." },
  ],
  questionPriorities: [
    { questionId: "q-ops-financial-controls", weight: 1.5, rationale: "Control testing." },
    { questionId: "q-fin-fund-operations", weight: 1.3, rationale: "Going concern." },
    { questionId: "q-legal-employment-agreements", weight: 1.25, rationale: "Payroll / people." },
    { questionId: "q-gov-board-approvals", weight: 1.2, rationale: "Approval evidence." },
    { questionId: "q-fin-recurring-healthy", weight: 1.15, rationale: "Revenue recognition." },
    { questionId: "q-ops-process-ownership", weight: 1.1, rationale: "Control owners." },
  ],
  requiredEvidence: [
    {
      evidenceType: "financial_statements",
      label: "Financial statements",
      why: "Audit reporting baseline.",
      level: "required",
    },
    {
      evidenceType: "financial_controls",
      label: "Financial controls documentation",
      why: "Control testing support.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "employment_agreements",
      label: "Employment agreements",
      why: "People process evidence.",
      level: "recommended",
    },
    {
      evidenceType: "board_minutes",
      label: "Board approvals",
      why: "Governance evidence for auditors.",
      level: "recommended",
    },
  ],
  reportSections: [
    "Audit readiness",
    "Financial reporting",
    "Controls",
    "PBC open items",
    "Legal support",
    "Next uploads",
  ],
  recommendationOrdering: [
    { theme: "control", weight: 1.4, rationale: "Audit testing." },
    { theme: "financial", weight: 1.3, rationale: "Reporting pack." },
    { theme: "audit", weight: 1.25, rationale: "PBC closeout." },
    { theme: "employment", weight: 1.15, rationale: "Support docs." },
  ],
  recommendationDimensionWeights: {
    "dim-operations": 1.3,
    "dim-financial": 1.25,
    "dim-legal": 1.1,
    "dim-governance": 1.1,
  },
  uploadCatalog: [
    {
      id: "upload-financials-audit",
      label: "Audited / draft financial statements",
      why: "Reporting package for the audit.",
      level: "required",
      evidenceTypes: ["financial_statements"],
    },
    {
      id: "upload-controls-docs",
      label: "Financial controls documentation",
      why: "PBC and control testing.",
      level: "required",
      evidenceTypes: ["financial_controls"],
    },
    {
      id: "upload-employment-audit",
      label: "Employment agreements sample",
      why: "People process evidence.",
      level: "recommended",
      evidenceTypes: ["employment_agreements"],
    },
  ],
  reportingTemplate: {
    id: "annual-audit-readiness",
    title: "Annual audit readiness brief",
    sections: [
      "Audit readiness",
      "Financial reporting",
      "Controls",
      "PBC open items",
      "Legal support",
    ],
  },
});
