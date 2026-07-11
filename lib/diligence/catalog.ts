/**
 * Static Due Diligence Question Catalog (v1).
 * Shared across all assessment goals — goals only reweight/reorder.
 */

import type { DiligenceQuestionDefinition } from "@/lib/domain/diligence-question";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import { ASSESSMENT_GOAL_IDS } from "@/lib/domain/assessment-goal";

export const DILIGENCE_CATALOG_VERSION = "diligence-catalog-v1";

const ALL_GOALS: AssessmentGoalId[] = [...ASSESSMENT_GOAL_IDS];

/** Early stages often lack formal board / audit artifacts. */
const EARLY_NA = {
  Idea: "not_applicable",
  "Pre-product / MVP": "optional",
  "Early Revenue": "optional",
} as const;

const GROWTH_REQUIRED = {
  "Product-Market Fit": "required",
  Growth: "required",
  Scale: "required",
  "Exit Ready": "required",
} as const;

export const DILIGENCE_QUESTION_CATALOG: DiligenceQuestionDefinition[] = [
  // ── Financial ────────────────────────────────────────────────────────────
  {
    id: "q-fin-fund-operations",
    title: "Can the company fund operations?",
    dimension: "dim-financial",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: { "raise-capital": 1.4, "run-the-company": 1.3 },
    requiredEvidenceTypes: ["cash_runway", "financial_statements"],
    optionalEvidenceTypes: ["burn_rate"],
    recommendationTemplate: {
      id: "rec-q-fund-operations",
      title: "Clarify operating funding capacity",
      description:
        "Upload a current cash and burn workbook so runway and funding capacity can be assessed.",
      rationale: "Without runway evidence, operating decisions lack a hard floor.",
      nextSteps: [
        "Upload latest cash / burn workbook",
        "Confirm monthly net burn",
        "Document funding plan for the next 12 months",
      ],
      effort: "medium",
      estimatedScoreImprovement: 8,
    },
  },
  {
    id: "q-fin-revenue-growing",
    title: "Is revenue growing?",
    dimension: "dim-financial",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.3, "run-the-company": 1.1 },
    requiredEvidenceTypes: ["revenue_growth", "financial_statements"],
    optionalEvidenceTypes: ["arr_snapshot"],
    recommendationTemplate: {
      id: "rec-q-revenue-growth",
      title: "Establish revenue growth evidence",
      description:
        "Provide period-over-period revenue or ARR so growth can be evaluated.",
      rationale: "Growth claims need source numbers, not narrative alone.",
      nextSteps: [
        "Upload trailing revenue by period",
        "Confirm ARR / MRR definition",
      ],
      effort: "low",
      estimatedScoreImprovement: 5,
    },
  },
  {
    id: "q-fin-runway-sufficient",
    title: "Is cash runway sufficient?",
    dimension: "dim-financial",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: { "raise-capital": 1.5, "run-the-company": 1.4 },
    requiredEvidenceTypes: ["cash_runway"],
    optionalEvidenceTypes: ["burn_rate"],
    recommendationTemplate: {
      id: "rec-extend-runway",
      title: "Extend cash runway",
      description:
        "Reduce burn or accelerate collections until runway clears policy thresholds.",
      rationale: "Short runway constrains hiring and negotiating leverage.",
      nextSteps: [
        "Re-forecast burn under base and downside cases",
        "Identify discretionary spend cuts",
        "Accelerate AR collections on top accounts",
      ],
      effort: "high",
      estimatedScoreImprovement: 12,
    },
  },
  {
    id: "q-fin-recurring-healthy",
    title: "Is recurring revenue healthy?",
    dimension: "dim-financial",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "not_applicable",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.2, "enterprise-sales": 1.1 },
    requiredEvidenceTypes: ["recurring_revenue_share"],
    optionalEvidenceTypes: ["arr_snapshot"],
    recommendationTemplate: {
      id: "rec-q-recurring-revenue",
      title: "Improve recurring revenue quality evidence",
      description:
        "Document recurring vs non-recurring mix from the financial system of record.",
      rationale: "Recurring mix is a core diligence signal for valuation.",
      nextSteps: ["Export ARR mix by product", "Reconcile to financial statements"],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },

  // ── Governance ───────────────────────────────────────────────────────────
  {
    id: "q-gov-board-approvals",
    title: "Are board approvals documented?",
    dimension: "dim-governance",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      ...EARLY_NA,
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: {
      "board-readiness": 1.5,
      "raise-capital": 1.3,
      "ipo-readiness": 1.4,
    },
    requiredEvidenceTypes: ["board_approvals", "board_minutes"],
    optionalEvidenceTypes: ["written_consents"],
    recommendationTemplate: {
      id: "rec-board-consents",
      title: "File retroactive board consents",
      description:
        "Prepare unanimous written consent for material actions lacking approval.",
      rationale: "Undocumented grants create compliance exposure.",
      nextSteps: [
        "Draft unanimous written consent with counsel",
        "Circulate for director signatures",
        "Attach executed consents in the board archive",
      ],
      effort: "medium",
      estimatedScoreImprovement: 14,
    },
  },
  {
    id: "q-gov-equity-issuances",
    title: "Are equity issuances approved?",
    dimension: "dim-governance",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.3, "board-readiness": 1.2 },
    requiredEvidenceTypes: ["option_grant_approvals", "board_minutes"],
    optionalEvidenceTypes: ["cap_table"],
    recommendationTemplate: {
      id: "rec-q-equity-approvals",
      title: "Document equity issuance approvals",
      description:
        "Ensure option grants and equity issuances have board (or written consent) approval on file.",
      rationale: "Unapproved issuances are a standard diligence blocker.",
      nextSteps: [
        "Reconcile grants to board minutes",
        "Execute missing consents",
      ],
      effort: "medium",
      estimatedScoreImprovement: 10,
    },
  },
  {
    id: "q-gov-cadence",
    title: "Is governance cadence appropriate?",
    dimension: "dim-governance",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      ...EARLY_NA,
      "Product-Market Fit": "optional",
      Growth: "required",
      Scale: "required",
      "Exit Ready": "required",
    },
    importance: "medium",
    goalImportance: { "board-readiness": 1.4, "ipo-readiness": 1.3 },
    requiredEvidenceTypes: ["board_minutes", "governance_cadence"],
    optionalEvidenceTypes: ["board_calendar"],
    recommendationTemplate: {
      id: "rec-q-gov-cadence",
      title: "Establish board meeting cadence",
      description:
        "Document a regular board cadence with minutes for each session.",
      rationale: "Investors expect predictable governance rhythm.",
      nextSteps: [
        "Set quarterly board calendar",
        "Archive minutes for the last four meetings",
      ],
      effort: "low",
      estimatedScoreImprovement: 4,
    },
  },

  // ── Legal ────────────────────────────────────────────────────────────────
  {
    id: "q-legal-ip-assignments",
    title: "Are IP assignments complete?",
    dimension: "dim-legal",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: {
      "sell-the-company": 1.4,
      "raise-capital": 1.3,
      "acquire-a-company": 1.2,
    },
    requiredEvidenceTypes: ["ip_assignments", "employment_agreements"],
    optionalEvidenceTypes: ["contractor_agreements"],
    recommendationTemplate: {
      id: "rec-ip-amendments",
      title: "Execute IP assignment amendments",
      description:
        "Send updated agreements covering missing IP assignment clauses.",
      rationale: "IP gaps are a standard diligence blocker.",
      nextSteps: [
        "Generate amendment pack from legal template",
        "Send to counterparties missing clauses",
        "Track signed returns",
      ],
      effort: "low",
      estimatedScoreImprovement: 6,
    },
  },
  {
    id: "q-legal-employment-agreements",
    title: "Are employment agreements present?",
    dimension: "dim-legal",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "annual-audit": 1.2, "sell-the-company": 1.2 },
    requiredEvidenceTypes: ["employment_agreements"],
    optionalEvidenceTypes: ["contractor_agreements"],
    recommendationTemplate: {
      id: "rec-q-employment-agreements",
      title: "Complete employment agreement coverage",
      description:
        "Ensure active employees and material contractors have signed agreements on file.",
      rationale: "Missing agreements create employment and IP risk.",
      nextSteps: [
        "Inventory active workers vs signed agreements",
        "Issue missing agreements",
      ],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },

  // ── Customer ─────────────────────────────────────────────────────────────
  {
    id: "q-cust-concentration",
    title: "Is customer concentration acceptable?",
    dimension: "dim-customer",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "not_applicable",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: { "raise-capital": 1.4, "run-the-company": 1.2 },
    requiredEvidenceTypes: ["customer_concentration", "arr_snapshot"],
    optionalEvidenceTypes: ["customer_contracts"],
    recommendationTemplate: {
      id: "rec-diversify-customers",
      title: "Diversify top-customer exposure",
      description:
        "Reduce top-customer ARR concentration below investor thresholds.",
      rationale: "Concentration is a primary customer-dimension risk.",
      nextSteps: [
        "Identify mid-market prospects",
        "Assign AE capacity to diversification",
        "Report top-3 share monthly",
      ],
      effort: "high",
      estimatedScoreImprovement: 8,
    },
  },
  {
    id: "q-cust-churn",
    title: "Is churn understood?",
    dimension: "dim-customer",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "not_applicable",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "run-the-company": 1.2, "raise-capital": 1.1 },
    requiredEvidenceTypes: ["churn_rate", "customer_metrics"],
    optionalEvidenceTypes: ["cohort_analysis"],
    recommendationTemplate: {
      id: "rec-q-churn",
      title: "Document churn and retention metrics",
      description:
        "Provide logo and revenue churn with cohort context.",
      rationale: "Unmeasured churn hides product and GTM risk.",
      nextSteps: [
        "Export churn by cohort",
        "Tag churn reason codes",
      ],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },
  {
    id: "q-cust-nrr",
    title: "Is NRR healthy?",
    dimension: "dim-customer",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "not_applicable",
      "Early Revenue": "optional",
      "Product-Market Fit": "required",
      Growth: "required",
      Scale: "required",
      "Exit Ready": "required",
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.3, "run-the-company": 1.2 },
    requiredEvidenceTypes: ["net_revenue_retention"],
    optionalEvidenceTypes: ["expansion_revenue"],
    recommendationTemplate: {
      id: "rec-improve-nrr",
      title: "Improve net revenue retention",
      description:
        "Deploy retention and expansion playbooks until NRR clears policy threshold.",
      rationale: "NRR below threshold compresses valuation.",
      nextSteps: [
        "Segment contracting accounts",
        "Assign CS owners to at-risk logos",
        "Launch expansion offers",
      ],
      effort: "medium",
      estimatedScoreImprovement: 6,
    },
  },

  // ── Security ─────────────────────────────────────────────────────────────
  {
    id: "q-sec-policies",
    title: "Does the company have documented security policies?",
    dimension: "dim-security",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "optional",
      "Product-Market Fit": "required",
      Growth: "required",
      Scale: "required",
      "Exit Ready": "required",
    },
    importance: "high",
    goalImportance: { "enterprise-sales": 1.5, "ipo-readiness": 1.3 },
    requiredEvidenceTypes: ["security_policies"],
    optionalEvidenceTypes: ["soc_report"],
    recommendationTemplate: {
      id: "rec-q-security-policies",
      title: "Publish security policy pack",
      description:
        "Document information security policies appropriate to customer risk.",
      rationale: "Enterprise buyers require written policy coverage.",
      nextSteps: [
        "Adopt baseline policy templates",
        "Assign policy owners",
        "Publish to the trust center",
      ],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },
  {
    id: "q-sec-incident-response",
    title: "Does it have incident response?",
    dimension: "dim-security",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "optional",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "enterprise-sales": 1.4, "annual-audit": 1.2 },
    requiredEvidenceTypes: ["incident_response", "security_controls"],
    optionalEvidenceTypes: ["tabletop_exercises"],
    recommendationTemplate: {
      id: "rec-q-incident-response",
      title: "Stand up incident response",
      description:
        "Document an IR plan with roles, severity levels, and notification paths.",
      rationale: "Missing IR is a common enterprise and audit gap.",
      nextSteps: [
        "Draft IR plan",
        "Assign on-call roles",
        "Run a tabletop exercise",
      ],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },
  {
    id: "q-sec-critical-controls",
    title: "Are critical security controls closed?",
    dimension: "dim-security",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "critical",
    goalImportance: { "enterprise-sales": 1.5, "run-the-company": 1.2 },
    requiredEvidenceTypes: ["security_controls", "mfa_coverage"],
    optionalEvidenceTypes: ["soc_report"],
    recommendationTemplate: {
      id: "rec-security-controls",
      title: "Close security control gaps",
      description:
        "Remediate open critical controls and raise MFA coverage above policy threshold.",
      rationale: "Control gaps block enterprise deals and elevate breach exposure.",
      nextSteps: [
        "Prioritize open critical controls",
        "Enforce MFA on remaining accounts",
        "Re-run control attestation",
      ],
      effort: "medium",
      estimatedScoreImprovement: 8,
    },
  },

  // ── Operations ───────────────────────────────────────────────────────────
  {
    id: "q-ops-kpi-monitoring",
    title: "Does management monitor KPIs?",
    dimension: "dim-operations",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "run-the-company": 1.4, "board-readiness": 1.2 },
    requiredEvidenceTypes: ["kpi_dashboard", "operating_metrics"],
    optionalEvidenceTypes: ["board_pack"],
    recommendationTemplate: {
      id: "rec-q-kpi-monitoring",
      title: "Establish KPI monitoring",
      description:
        "Publish a recurring operating dashboard covering the metrics leadership uses.",
      rationale: "Unmonitored KPIs delay corrective action.",
      nextSteps: [
        "Define executive KPI set",
        "Automate weekly refresh",
        "Include in board pack",
      ],
      effort: "medium",
      estimatedScoreImprovement: 4,
    },
  },
  {
    id: "q-ops-process-ownership",
    title: "Are critical processes owned?",
    dimension: "dim-operations",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "medium",
    goalImportance: { "run-the-company": 1.3 },
    requiredEvidenceTypes: ["process_ownership", "org_chart"],
    optionalEvidenceTypes: ["runbooks"],
    recommendationTemplate: {
      id: "rec-q-process-ownership",
      title: "Assign process owners",
      description:
        "Map critical operating processes to named owners with backups.",
      rationale: "Unowned processes create execution drag.",
      nextSteps: [
        "List critical processes",
        "Assign primary and backup owners",
      ],
      effort: "low",
      estimatedScoreImprovement: 3,
    },
  },

  // ── People ───────────────────────────────────────────────────────────────
  {
    id: "q-people-key-person",
    title: "Are key-person risks identified?",
    dimension: "dim-people",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: {
      "run-the-company": 1.3,
      "raise-capital": 1.2,
      "sell-the-company": 1.2,
    },
    requiredEvidenceTypes: ["key_person_risk", "org_chart"],
    optionalEvidenceTypes: ["succession_plan"],
    recommendationTemplate: {
      id: "rec-key-person",
      title: "Reduce key-person dependency",
      description:
        "Document runbooks and assign secondary owners for single-owner critical functions.",
      rationale: "Single-owner functions create operational and diligence risk.",
      nextSteps: [
        "List critical single-owner functions",
        "Assign secondary owners",
        "Publish runbooks",
      ],
      effort: "medium",
      estimatedScoreImprovement: 6,
    },
  },
  {
    id: "q-people-attrition",
    title: "Is voluntary attrition healthy?",
    dimension: "dim-people",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "optional",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "medium",
    goalImportance: { "run-the-company": 1.2 },
    requiredEvidenceTypes: ["attrition_rate"],
    optionalEvidenceTypes: ["headcount_plan"],
    recommendationTemplate: {
      id: "rec-q-attrition",
      title: "Document attrition metrics",
      description:
        "Provide voluntary attrition with period context and exit themes.",
      rationale: "Unmeasured attrition hides people risk.",
      nextSteps: [
        "Export trailing attrition",
        "Tag exit reasons",
      ],
      effort: "low",
      estimatedScoreImprovement: 3,
    },
  },

  // Additional high-value questions to reach ~25
  {
    id: "q-fin-concentration-financial",
    title: "Is customer concentration excessive?",
    dimension: "dim-financial",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "not_applicable",
      "Early Revenue": "optional",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.3 },
    requiredEvidenceTypes: ["customer_concentration"],
    optionalEvidenceTypes: ["arr_snapshot"],
    recommendationTemplate: {
      id: "rec-q-fin-concentration",
      title: "Address revenue concentration",
      description:
        "Reduce reliance on a small set of customers for ARR.",
      rationale: "Concentration elevates downside risk in financial diligence.",
      nextSteps: [
        "Quantify top-customer ARR share",
        "Set diversification targets",
      ],
      effort: "high",
      estimatedScoreImprovement: 6,
    },
  },
  {
    id: "q-gov-cap-table",
    title: "Is the cap table current and reconciled?",
    dimension: "dim-governance",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "required",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "raise-capital": 1.4, "ipo-readiness": 1.3 },
    requiredEvidenceTypes: ["cap_table"],
    optionalEvidenceTypes: ["board_minutes"],
    recommendationTemplate: {
      id: "rec-q-cap-table",
      title: "Reconcile the cap table",
      description:
        "Produce a current cap table reconciled to issued equity and options.",
      rationale: "Stale cap tables block fundraising and M&A.",
      nextSteps: [
        "Export current capitalization",
        "Reconcile to board approvals",
      ],
      effort: "medium",
      estimatedScoreImprovement: 5,
    },
  },
  {
    id: "q-legal-customer-contracts",
    title: "Are material customer contracts on file?",
    dimension: "dim-legal",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "not_applicable",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: {
      "enterprise-sales": 1.3,
      "sell-the-company": 1.3,
      "acquire-a-company": 1.2,
    },
    requiredEvidenceTypes: ["customer_contracts"],
    optionalEvidenceTypes: ["msa_templates"],
    recommendationTemplate: {
      id: "rec-q-customer-contracts",
      title: "Archive material customer contracts",
      description:
        "Collect executed MSAs and order forms for material customers.",
      rationale: "Contract gaps undermine revenue diligence.",
      nextSteps: [
        "List material customers",
        "File executed agreements",
      ],
      effort: "medium",
      estimatedScoreImprovement: 4,
    },
  },
  {
    id: "q-ops-financial-controls",
    title: "Are basic financial controls in place?",
    dimension: "dim-operations",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "high",
    goalImportance: { "annual-audit": 1.5, "ipo-readiness": 1.3 },
    requiredEvidenceTypes: ["financial_controls", "financial_statements"],
    optionalEvidenceTypes: ["audit_report"],
    recommendationTemplate: {
      id: "rec-q-financial-controls",
      title: "Document financial controls",
      description:
        "Describe approval thresholds, close process, and system access for finance.",
      rationale: "Audit and IPO readiness require control evidence.",
      nextSteps: [
        "Document close checklist",
        "Define spend approval matrix",
      ],
      effort: "medium",
      estimatedScoreImprovement: 4,
    },
  },
  {
    id: "q-people-org-clarity",
    title: "Is organizational ownership clear?",
    dimension: "dim-people",
    assessmentGoals: ALL_GOALS,
    stageLevels: {
      Idea: "optional",
      "Pre-product / MVP": "optional",
      "Early Revenue": "required",
      ...GROWTH_REQUIRED,
    },
    importance: "medium",
    goalImportance: { "run-the-company": 1.2, "board-readiness": 1.1 },
    requiredEvidenceTypes: ["org_chart"],
    optionalEvidenceTypes: ["role_descriptions"],
    recommendationTemplate: {
      id: "rec-q-org-clarity",
      title: "Publish a current org chart",
      description:
        "Maintain an org chart that maps roles to owners for critical functions.",
      rationale: "Unclear ownership slows execution and diligence.",
      nextSteps: [
        "Publish org chart",
        "Map critical functions to owners",
      ],
      effort: "low",
      estimatedScoreImprovement: 3,
    },
  },
];

export function getQuestionDefinition(
  questionId: string,
): DiligenceQuestionDefinition | undefined {
  return DILIGENCE_QUESTION_CATALOG.find((q) => q.id === questionId);
}

export function listQuestionsForDimension(
  dimension: DiligenceQuestionDefinition["dimension"],
): DiligenceQuestionDefinition[] {
  return DILIGENCE_QUESTION_CATALOG.filter((q) => q.dimension === dimension);
}
