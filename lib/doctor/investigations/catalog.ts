/**
 * Investigation templates — static catalog.
 * Stage + assessment goal reweight; evidence requests stay sparse (one at a time).
 */

import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import { COMPANY_LIFECYCLE_STAGES } from "@/lib/domain/company-classification";
import type { DoctorInvestigationTemplate } from "@/lib/domain/doctor-conversation";

const ALL: CompanyLifecycleStage[] = [...COMPANY_LIFECYCLE_STAGES];
const GROWTH_PLUS: CompanyLifecycleStage[] = [
  "Early Revenue",
  "Product-Market Fit",
  "Growth",
  "Scale",
  "Exit Ready",
];
const BOARD_PLUS: CompanyLifecycleStage[] = [
  "Product-Market Fit",
  "Growth",
  "Scale",
  "Exit Ready",
];

export const DOCTOR_INVESTIGATION_CATALOG: DoctorInvestigationTemplate[] = [
  {
    id: "inv-runway-shortening",
    title: "Runway shortening",
    businessQuestion: "Is cash runway sufficient for the next 12 months?",
    hypotheses: [
      "Burn is higher than plan",
      "Collections are slowing",
      "Revenue is not covering operating costs",
    ],
    requiredEvidence: [
      {
        id: "req-cash-runway",
        label: "Cash / burn workbook",
        evidenceTypes: ["cash_runway", "financial_statements"],
        why: "Runway is the hard floor for Protect decisions.",
        expectedInsight:
          "I can tell whether runway risk is burn-driven or revenue-driven.",
        estimatedEffort: "low",
        level: "required",
      },
    ],
    applicableStages: ALL,
    goalWeights: {
      "run-the-company": 1.5,
      "raise-capital": 1.4,
      "sell-the-company": 1.1,
    },
    basePriority: 100,
    signalKeywords: ["runway", "burn", "cash", "funding"],
    highValueQuestion:
      "What is your current cash runway in months under the base case?",
    recommendationTemplate: {
      id: "rec-extend-runway",
      title: "Stabilize runway",
      description:
        "Re-forecast burn and identify the fastest levers to extend runway.",
      rationale: "Short runway constrains every other decision.",
    },
  },
  {
    id: "inv-customer-concentration",
    title: "Customer concentration",
    businessQuestion: "Is revenue too concentrated in a few customers?",
    hypotheses: [
      "Top accounts represent a material share of ARR",
      "Churn of one account would damage the business",
    ],
    requiredEvidence: [
      {
        id: "req-arr-cohort",
        label: "Customer revenue export",
        evidenceTypes: ["arr_snapshot", "revenue_growth"],
        why: "Concentration risk changes Grow and Protect priorities.",
        expectedInsight:
          "I can determine whether revenue risk is concentration or churn.",
        estimatedEffort: "medium",
        connectAlternative: "Connect HubSpot",
        level: "required",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "run-the-company": 1.3,
      "raise-capital": 1.35,
      "sell-the-company": 1.4,
      "acquire-a-company": 1.3,
    },
    basePriority: 90,
    signalKeywords: ["concentration", "customer", "arr", "churn"],
    highValueQuestion:
      "What share of ARR comes from your top three customers?",
    recommendationTemplate: {
      id: "rec-diversify",
      title: "Reduce concentration exposure",
      description:
        "Diversify pipeline and strengthen retention on top accounts.",
      rationale: "Single-customer dependence is a material downside.",
    },
  },
  {
    id: "inv-revenue-slowing",
    title: "Revenue slowing",
    businessQuestion: "Is revenue growth decelerating, and why?",
    hypotheses: [
      "New customer acquisition is slowing",
      "Churn / contraction is rising",
      "Pricing or packaging is limiting expansion",
    ],
    requiredEvidence: [
      {
        id: "req-revenue-trend",
        label: "Period revenue / ARR trend",
        evidenceTypes: ["revenue_growth", "arr_snapshot"],
        why: "Growth trajectory drives Operate and Raise priorities.",
        expectedInsight:
          "I can separate acquisition slowdown from churn-driven decline.",
        estimatedEffort: "medium",
        connectAlternative: "Connect HubSpot",
        level: "required",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "run-the-company": 1.25,
      "raise-capital": 1.45,
    },
    basePriority: 88,
    signalKeywords: ["revenue", "growth", "arr", "slow"],
    highValueQuestion:
      "Is month-over-month revenue up, flat, or down over the last quarter?",
    recommendationTemplate: {
      id: "rec-growth-diagnosis",
      title: "Diagnose growth constraint",
      description:
        "Isolate whether acquisition, retention, or expansion is the bottleneck.",
      rationale: "The wrong fix wastes the next quarter.",
    },
  },
  {
    id: "inv-cash-declining",
    title: "Cash declining",
    businessQuestion: "Is cash declining faster than the operating plan?",
    hypotheses: [
      "OpEx is ahead of plan",
      "Working capital is tightening",
    ],
    requiredEvidence: [
      {
        id: "req-cash-position",
        label: "Latest cash position",
        evidenceTypes: ["cash_runway", "financial_statements"],
        why: "Cash trajectory is the first Protect signal.",
        expectedInsight: "I can judge whether the decline is planned or surprising.",
        estimatedEffort: "low",
        level: "required",
      },
    ],
    applicableStages: ALL,
    goalWeights: {
      "run-the-company": 1.4,
      "raise-capital": 1.2,
      "annual-audit": 1.1,
    },
    basePriority: 95,
    signalKeywords: ["cash", "liquidity", "burn"],
    highValueQuestion: "How much cash do you have on hand today?",
    recommendationTemplate: {
      id: "rec-cash-control",
      title: "Tighten cash control",
      description: "Install a weekly cash pulse and discretionary spend gate.",
      rationale: "Cash surprises destroy operating options.",
    },
  },
  {
    id: "inv-governance-gaps",
    title: "Governance gaps",
    businessQuestion: "Are material decisions documented and approved?",
    hypotheses: [
      "Board cadence is irregular",
      "Approvals are missing for equity or major contracts",
    ],
    requiredEvidence: [
      {
        id: "req-board-minutes",
        label: "Board minutes or written consents",
        evidenceTypes: ["board_minutes"],
        why: "Governance gaps block Prepare / Decide and later transactions.",
        expectedInsight:
          "I can see whether approvals exist for material actions.",
        estimatedEffort: "medium",
        level: "recommended",
      },
    ],
    applicableStages: BOARD_PLUS,
    goalWeights: {
      "run-the-company": 1.0,
      "board-readiness": 1.5,
      "raise-capital": 1.2,
      "ipo-readiness": 1.4,
      "sell-the-company": 1.25,
    },
    basePriority: 70,
    signalKeywords: ["board", "governance", "approval", "minutes"],
    highValueQuestion:
      "When was your last formal board meeting or written consent?",
    recommendationTemplate: {
      id: "rec-board-hygiene",
      title: "Close governance gaps",
      description: "Schedule cadence and document outstanding approvals.",
      rationale: "Missing approvals become blockers under diligence.",
    },
  },
  {
    id: "inv-board-approvals",
    title: "Board approvals",
    businessQuestion: "Are equity issuances and major deals properly approved?",
    hypotheses: [
      "Equity grants lack contemporaneous approval",
      "Major contracts lack board authority",
    ],
    requiredEvidence: [
      {
        id: "req-approvals",
        label: "Approval trail / board consents",
        evidenceTypes: ["board_minutes", "cap_table"],
        why: "Approval hygiene is required for raise, sell, and IPO paths.",
        expectedInsight: "I can flag unsigned or undated material actions.",
        estimatedEffort: "medium",
        level: "required",
      },
    ],
    applicableStages: BOARD_PLUS,
    goalWeights: {
      "board-readiness": 1.45,
      "raise-capital": 1.3,
      "sell-the-company": 1.35,
      "ipo-readiness": 1.35,
    },
    basePriority: 72,
    signalKeywords: ["approval", "consent", "equity", "board"],
    highValueQuestion:
      "Do you have written approval for the last equity issuance?",
    recommendationTemplate: {
      id: "rec-approvals",
      title: "Complete approval trail",
      description: "Backfill missing consents and set an approval checklist.",
      rationale: "Unsigned actions create legal and investor risk.",
    },
  },
  {
    id: "inv-security-readiness",
    title: "Security readiness",
    businessQuestion: "Can we pass an enterprise security review?",
    hypotheses: [
      "Policies are incomplete",
      "Incident response is undocumented",
      "Critical controls are not evidenced",
    ],
    requiredEvidence: [
      {
        id: "req-security-pack",
        label: "Security policies or SOC 2",
        evidenceTypes: ["security_policies", "soc2", "incident_response"],
        why: "Enterprise deals gate on security evidence.",
        expectedInsight:
          "I can identify the single highest-leverage trust artifact to upload next.",
        estimatedEffort: "medium",
        level: "required",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "enterprise-sales": 1.5,
      "ipo-readiness": 1.3,
      "run-the-company": 0.9,
    },
    basePriority: 80,
    signalKeywords: ["security", "soc", "privacy", "incident", "mfa"],
    highValueQuestion:
      "Do you have a current security policy pack or SOC 2 report?",
    recommendationTemplate: {
      id: "rec-security-pack",
      title: "Assemble enterprise trust pack",
      description: "Prioritize SOC 2 / policies / IR for vendor questionnaires.",
      rationale: "Missing trust artifacts stall enterprise pipeline.",
    },
  },
  {
    id: "inv-legal-risk",
    title: "Legal risk",
    businessQuestion: "Are IP assignments and customer contracts clean?",
    hypotheses: [
      "IP assignments are incomplete",
      "Customer contracts create transfer risk",
    ],
    requiredEvidence: [
      {
        id: "req-ip",
        label: "IP assignment agreements",
        evidenceTypes: ["ip_assignments", "customer_contracts"],
        why: "Legal hygiene dominates sell-side and acquisition diligence.",
        expectedInsight: "I can see whether title and contract risk are material.",
        estimatedEffort: "high",
        level: "required",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "sell-the-company": 1.5,
      "acquire-a-company": 1.4,
      "ipo-readiness": 1.15,
    },
    basePriority: 78,
    signalKeywords: ["legal", "ip", "contract", "assignment"],
    highValueQuestion:
      "Have all employees and contractors signed IP assignment agreements?",
    recommendationTemplate: {
      id: "rec-legal-cleanup",
      title: "Close legal diligence gaps",
      description: "Complete IP assignments and inventory customer contracts.",
      rationale: "Legal gaps become deal killers late.",
    },
  },
  {
    id: "inv-hiring-too-quickly",
    title: "Hiring too quickly",
    businessQuestion: "Is headcount growth outpacing operating capacity?",
    hypotheses: [
      "Burn is rising faster than revenue",
      "Org ownership is unclear",
    ],
    requiredEvidence: [
      {
        id: "req-org",
        label: "Org chart / headcount plan",
        evidenceTypes: ["org_chart"],
        why: "Hiring pace affects Protect and Operate simultaneously.",
        expectedInsight: "I can judge whether hiring is ahead of process maturity.",
        estimatedEffort: "low",
        level: "recommended",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "run-the-company": 1.15,
    },
    basePriority: 60,
    signalKeywords: ["hiring", "headcount", "people", "attrition"],
    highValueQuestion:
      "Has headcount grown more than 25% in the last two quarters?",
    recommendationTemplate: {
      id: "rec-hiring-pace",
      title: "Align hiring to operating capacity",
      description: "Pause non-critical roles until ownership and burn are clear.",
      rationale: "Premature hiring burns runway without output.",
    },
  },
  {
    id: "inv-operational-efficiency",
    title: "Operational efficiency",
    businessQuestion: "Are KPIs monitored and owned?",
    hypotheses: [
      "Critical KPIs lack owners",
      "Process ownership is unclear",
    ],
    requiredEvidence: [
      {
        id: "req-kpi",
        label: "KPI dashboard or operating review",
        evidenceTypes: ["org_chart", "financial_statements"],
        why: "Operate lens needs signal on internal drag.",
        expectedInsight: "I can spot the highest-friction operating gap.",
        estimatedEffort: "medium",
        level: "recommended",
      },
    ],
    applicableStages: GROWTH_PLUS,
    goalWeights: {
      "run-the-company": 1.2,
      "annual-audit": 1.1,
    },
    basePriority: 65,
    signalKeywords: ["kpi", "operations", "efficiency", "process"],
    highValueQuestion: "Which weekly KPI review do you run today, if any?",
    recommendationTemplate: {
      id: "rec-ops-kpis",
      title: "Install operating cadence",
      description: "Define owners for the top five operating KPIs.",
      rationale: "Unowned metrics do not improve.",
    },
  },
  {
    id: "inv-product-execution",
    title: "Product execution",
    businessQuestion: "Is product delivery aligned to the next milestone?",
    hypotheses: [
      "Roadmap is not evidence-backed",
      "Delivery ownership is diffuse",
    ],
    requiredEvidence: [
      {
        id: "req-roadmap",
        label: "Product roadmap",
        evidenceTypes: ["org_chart"],
        why: "Prepare / Decide needs a clear next product milestone.",
        expectedInsight: "I can judge whether execution risk is planning or capacity.",
        estimatedEffort: "low",
        level: "recommended",
      },
    ],
    applicableStages: [
      "Pre-product / MVP",
      "Early Revenue",
      "Product-Market Fit",
      "Growth",
    ],
    goalWeights: {
      "run-the-company": 1.1,
    },
    basePriority: 55,
    signalKeywords: ["product", "roadmap", "execution", "delivery"],
    highValueQuestion:
      "What is the single product milestone that matters most this quarter?",
    recommendationTemplate: {
      id: "rec-product-focus",
      title: "Focus product execution",
      description: "Collapse the roadmap to one milestone with a clear owner.",
      rationale: "Diffuse roadmaps delay learning.",
    },
  },
];

export function getInvestigationTemplate(
  id: string,
): DoctorInvestigationTemplate | undefined {
  return DOCTOR_INVESTIGATION_CATALOG.find((t) => t.id === id);
}
