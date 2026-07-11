import { definePlaybook } from "../base";

export const enterpriseSalesPlaybook = definePlaybook({
  id: "enterprise-sales",
  label: "Enterprise Sales",
  objective:
    "Prioritize security, privacy, availability, and vendor diligence for enterprise deals.",
  successCriteria: [
    "Security policies are current and evidenced",
    "Incident response is documented",
    "Critical controls (e.g. MFA) are demonstrable",
    "Vendor diligence pack is ready for enterprise buyers",
  ],
  focusAreas: [
    "Security",
    "Privacy",
    "Availability",
    "Vendor diligence",
  ],
  dimensionPriorities: [
    { dimensionId: "dim-security", weight: 1, rationale: "Enterprise gate." },
    { dimensionId: "dim-legal", weight: 0.85, rationale: "Contractual commitments." },
    { dimensionId: "dim-operations", weight: 0.8, rationale: "Availability / process." },
    { dimensionId: "dim-customer", weight: 0.75, rationale: "Customer proof." },
    { dimensionId: "dim-governance", weight: 0.7, rationale: "Policy ownership." },
  ],
  questionPriorities: [
    { questionId: "q-sec-policies", weight: 1.5, rationale: "Policy baseline." },
    { questionId: "q-sec-critical-controls", weight: 1.5, rationale: "Control proof." },
    { questionId: "q-sec-incident-response", weight: 1.4, rationale: "IR readiness." },
    { questionId: "q-legal-customer-contracts", weight: 1.2, rationale: "MSA / DPA terms." },
    { questionId: "q-ops-process-ownership", weight: 1.1, rationale: "Operational ownership." },
    { questionId: "q-cust-nrr", weight: 1.05, rationale: "Customer health proof." },
  ],
  requiredEvidence: [
    {
      evidenceType: "security_policies",
      label: "Security policies",
      why: "Enterprise security review.",
      level: "required",
    },
    {
      evidenceType: "incident_response",
      label: "Incident response plan",
      why: "Buyer IR diligence.",
      level: "required",
    },
  ],
  recommendedEvidence: [
    {
      evidenceType: "soc2",
      label: "SOC 2 / trust report",
      why: "Accelerates vendor review.",
      level: "recommended",
    },
    {
      evidenceType: "mfa_coverage",
      label: "Critical controls evidence",
      why: "MFA and control proof.",
      level: "recommended",
    },
  ],
  reportSections: [
    "Enterprise readiness",
    "Security & privacy",
    "Availability & IR",
    "Vendor diligence pack",
    "Open questionnaires",
    "Next uploads",
  ],
  recommendationOrdering: [
    { theme: "security", weight: 1.45, rationale: "Deal blocker." },
    { theme: "incident", weight: 1.35, rationale: "IR pack." },
    { theme: "privacy", weight: 1.3, rationale: "DPA / privacy." },
    { theme: "control", weight: 1.25, rationale: "Critical controls." },
    { theme: "vendor", weight: 1.2, rationale: "Questionnaire speed." },
  ],
  recommendationDimensionWeights: {
    "dim-security": 1.4,
    "dim-legal": 1.15,
    "dim-operations": 1.1,
  },
  uploadCatalog: [
    {
      id: "upload-soc2",
      label: "SOC 2",
      why: "Fastest path through enterprise security review.",
      level: "required",
      evidenceTypes: ["soc2"],
    },
    {
      id: "upload-security-policies",
      label: "Security policies",
      why: "Baseline for vendor questionnaires.",
      level: "required",
      evidenceTypes: ["security_policies"],
    },
    {
      id: "upload-incident-response",
      label: "Incident response",
      why: "Required IR diligence artifact.",
      level: "required",
      evidenceTypes: ["incident_response"],
    },
  ],
  reportingTemplate: {
    id: "enterprise-sales-trust",
    title: "Enterprise sales trust brief",
    sections: [
      "Enterprise readiness",
      "Security & privacy",
      "Availability & IR",
      "Vendor diligence pack",
      "Open questionnaires",
    ],
  },
});
