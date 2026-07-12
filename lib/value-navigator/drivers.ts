/**
 * Value Driver engine — ranks levers by expected value impact × goal weight.
 * Every driver carries explainability (current/target, rationale, assumptions, evidence).
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  MoneyRange,
  ValuationEstimate,
  ValuationEstimateInput,
  ValueAssumption,
  ValueDriver,
  ValueDriverKey,
} from "@/lib/domain/value-navigator";
import { driverGoalWeight } from "./goal-weights";
import { clampPct, mid, moneyRange } from "./money";

type DriverSpec = {
  key: ValueDriverKey;
  title: string;
  difficulty: ValueDriver["difficulty"];
  estimatedTime: string;
  requiredEvidence: string[];
  dependencies: string[];
  targetMetric: string;
  build: (ctx: {
    input: ValuationEstimateInput;
    estimate: ValuationEstimate;
  }) => {
    impact: MoneyRange;
    confidence: number;
    currentMetric: string | null;
    rationale: string;
    assumptions: ValueAssumption[];
    supportingEvidenceIds: string[];
    status: ValueDriver["status"];
  } | null;
};

function impactFromGap(
  estimate: ValuationEstimate,
  shareLow: number,
  shareHigh: number,
): MoneyRange {
  const gapLow = Math.max(0, estimate.potentialRange.low - estimate.currentRange.high);
  const gapHigh = Math.max(0, estimate.potentialRange.high - estimate.currentRange.low);
  // If gap collapsed, use a share of current mid as illustrative band only when
  // we have a positive current estimate — still a range, never a point.
  if (gapHigh <= 0) {
    const m = mid(estimate.currentRange);
    if (m <= 0) return moneyRange(0, 0);
    return moneyRange(m * shareLow * 0.05, m * shareHigh * 0.12);
  }
  return moneyRange(gapLow * shareLow, gapHigh * shareHigh);
}

const DRIVER_SPECS: DriverSpec[] = [
  {
    key: "customer-concentration",
    title: "Customer concentration",
    difficulty: "high",
    estimatedTime: "3–9 months",
    requiredEvidence: ["Customer revenue report / ARR by account"],
    dependencies: [],
    targetMetric: "≤20% top-3 ARR",
    build: ({ input, estimate }) => {
      const share = input.top3CustomerArrShare;
      if (share == null) {
        return {
          impact: impactFromGap(estimate, 0.15, 0.35),
          confidence: 25,
          currentMetric: null,
          rationale:
            "Comparable SaaS companies with lower customer concentration often command higher valuation multiples. I can estimate the impact once customer revenue evidence is available.",
          assumptions: [
            {
              id: "conc-missing",
              statement: "Concentration metric missing — impact band is provisional.",
              source: "heuristic",
            },
          ],
          supportingEvidenceIds: [],
          status: "open",
        };
      }
      if (share < 0.25) return null;
      const pct = (share * 100).toFixed(0);
      return {
        impact: impactFromGap(estimate, 0.2, 0.4),
        confidence: clampPct(50 + estimate.confidence * 0.3),
        currentMetric: `${pct}% top-3 ARR`,
        rationale: `Current top-3 concentration is ${pct}%. Target ≤20%. Comparable SaaS companies with lower customer concentration often command higher valuation multiples and lower risk discounts.`,
        assumptions: [
          {
            id: "conc-target",
            statement: "Target concentration ≤20% top-3 ARR is a diligence heuristic, not a guarantee of multiple expansion.",
            source: "heuristic",
          },
          {
            id: "conc-obs",
            statement: `Observed top3CustomerArrShare=${pct}%.`,
            source: "evidence",
          },
        ],
        supportingEvidenceIds: input.evidenceIds.slice(0, 5),
        status: "open",
      };
    },
  },
  {
    key: "recurring-revenue",
    title: "Recurring revenue",
    difficulty: "medium",
    estimatedTime: "6–12 months",
    requiredEvidence: ["ARR / subscription mix report"],
    dependencies: [],
    targetMetric: "≥80% recurring",
    build: ({ input, estimate }) => {
      const share = input.recurringRevenueShare;
      if (share != null && share >= 0.8) return null;
      return {
        impact: impactFromGap(estimate, 0.1, 0.25),
        confidence: share != null ? clampPct(45 + estimate.confidence * 0.25) : 28,
        currentMetric:
          share != null ? `${(share * 100).toFixed(0)}% recurring` : null,
        rationale:
          "Higher recurring revenue mix typically supports more durable cash flows and stronger multiples versus project/services-heavy mixes.",
        assumptions: [
          {
            id: "rr-target",
            statement: "Target ≥80% recurring is a SaaS quality heuristic.",
            source: "heuristic",
          },
        ],
        supportingEvidenceIds: input.evidenceIds.slice(0, 3),
        status: "open",
      };
    },
  },
  {
    key: "gross-margin",
    title: "Gross margin",
    difficulty: "medium",
    estimatedTime: "3–6 months",
    requiredEvidence: ["P&L / gross margin bridge"],
    dependencies: [],
    targetMetric: "≥70%",
    build: ({ input, estimate }) => {
      const gm = input.grossMargin;
      if (gm != null && gm >= 0.7) return null;
      return {
        impact: impactFromGap(estimate, 0.12, 0.28),
        confidence: gm != null ? clampPct(50 + estimate.confidence * 0.25) : 30,
        currentMetric: gm != null ? `${(gm * 100).toFixed(0)}%` : null,
        rationale:
          "Gross margin improvements expand contribution profit and often support higher earnings-quality multiples.",
        assumptions: [
          {
            id: "gm-target",
            statement: "Target ≥70% gross margin is a software quality band, not universal.",
            source: "heuristic",
          },
        ],
        supportingEvidenceIds: input.evidenceIds.slice(0, 3),
        status: "open",
      };
    },
  },
  {
    key: "cash-runway",
    title: "Cash runway",
    difficulty: "high",
    estimatedTime: "1–4 months",
    requiredEvidence: ["Cash / burn workbook"],
    dependencies: [],
    targetMetric: "≥12 months",
    build: ({ input, estimate }) => {
      const months = input.cashRunwayMonths;
      if (months != null && months >= 12) return null;
      return {
        impact: impactFromGap(estimate, 0.08, 0.22),
        confidence: months != null ? clampPct(55 + estimate.confidence * 0.2) : 32,
        currentMetric: months != null ? `${months} months` : null,
        rationale:
          "Short runway forces distressed decisions and compresses negotiation leverage — extending runway protects enterprise value optionality.",
        assumptions: [
          {
            id: "runway-target",
            statement: "Target ≥12 months runway is an operating heuristic for Protect mode.",
            source: "heuristic",
          },
        ],
        supportingEvidenceIds: input.evidenceIds.slice(0, 3),
        status: "open",
      };
    },
  },
  {
    key: "revenue-growth",
    title: "Revenue growth",
    difficulty: "high",
    estimatedTime: "6–18 months",
    requiredEvidence: ["ARR trend / cohort growth"],
    dependencies: ["sales-efficiency"],
    targetMetric: "≥30% YoY",
    build: ({ input, estimate }) => {
      const g = input.growthRate;
      if (g != null && g >= 0.3) return null;
      return {
        impact: impactFromGap(estimate, 0.25, 0.5),
        confidence: g != null ? clampPct(48 + estimate.confidence * 0.3) : 30,
        currentMetric: g != null ? `${(g * 100).toFixed(0)}% YoY` : null,
        rationale:
          "Growth is a primary driver of revenue-multiple bands; sustained higher growth expands both current and potential enterprise value ranges.",
        assumptions: [
          {
            id: "growth-target",
            statement: "Target ≥30% YoY is a growth-stage heuristic, not a guarantee.",
            source: "heuristic",
          },
        ],
        supportingEvidenceIds: input.evidenceIds.slice(0, 3),
        status: "open",
      };
    },
  },
  {
    key: "governance",
    title: "Governance",
    difficulty: "medium",
    estimatedTime: "2–4 months",
    requiredEvidence: ["Board pack / governance checklist"],
    dependencies: [],
    targetMetric: "Board-ready cadence",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.03, 0.1),
      confidence: 35,
      currentMetric: null,
      rationale:
        "Stronger governance reduces diligence friction and supports higher confidence in exit or raise processes — impact is usually smaller than core financial drivers but material for investor readiness.",
      assumptions: [
        {
          id: "gov-qual",
          statement: "Governance impact is qualitative and capped relative to financial drivers.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
  {
    key: "soc2",
    title: "SOC2",
    difficulty: "high",
    estimatedTime: "4–9 months",
    requiredEvidence: ["Security / SOC2 status"],
    dependencies: [],
    targetMetric: "SOC2 Type II in progress or complete",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.04, 0.12),
      confidence: 38,
      currentMetric: null,
      rationale:
        "SOC2 unlocks enterprise procurement and reduces trust discount in enterprise sales and some exits — value impact is trust-mediated, not a direct multiple formula.",
      assumptions: [
        {
          id: "soc2-qual",
          statement: "SOC2 value impact is estimated via enterprise-readiness heuristic, not a market quote.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
  {
    key: "leadership",
    title: "Leadership",
    difficulty: "high",
    estimatedTime: "3–12 months",
    requiredEvidence: ["Org chart / leadership gaps"],
    dependencies: [],
    targetMetric: "Key seats filled",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.05, 0.15),
      confidence: 30,
      currentMetric: null,
      rationale:
        "Leadership gaps (e.g. VP Sales) constrain growth execution; filling seats can expand achievable growth within the potential value band.",
      assumptions: [
        {
          id: "lead-qual",
          statement: "Leadership impact is scenario-sensitive and not derived from a single financial fact.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
  {
    key: "sales-efficiency",
    title: "Sales efficiency",
    difficulty: "medium",
    estimatedTime: "3–6 months",
    requiredEvidence: ["CAC / payback / pipeline"],
    dependencies: ["revenue-growth"],
    targetMetric: "Healthy CAC payback",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.08, 0.2),
      confidence: 32,
      currentMetric: null,
      rationale:
        "Better sales efficiency improves capital efficiency and supports growth without proportional burn — expanding the achievable potential value range.",
      assumptions: [
        {
          id: "sales-eff",
          statement: "Sales efficiency impact assumes CAC/payback evidence will be provided.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
  {
    key: "product-execution",
    title: "Product execution",
    difficulty: "high",
    estimatedTime: "6–18 months",
    requiredEvidence: ["Roadmap / release cadence"],
    dependencies: [],
    targetMetric: "Predictable delivery",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.06, 0.18),
      confidence: 28,
      currentMetric: null,
      rationale:
        "Product execution underpins retention and expansion; weak delivery increases churn risk and compresses multiples.",
      assumptions: [
        {
          id: "prod-qual",
          statement: "Product impact is qualitative until retention/NRR evidence is linked.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
  {
    key: "pricing",
    title: "Pricing",
    difficulty: "medium",
    estimatedTime: "2–6 months",
    requiredEvidence: ["Pricing sheet / win-loss"],
    dependencies: ["gross-margin"],
    targetMetric: "Value-aligned packaging",
    build: ({ estimate }) => ({
      impact: impactFromGap(estimate, 0.07, 0.18),
      confidence: 30,
      currentMetric: null,
      rationale:
        "Pricing power improves ARPU and margin; packaging changes can expand revenue without proportional cost.",
      assumptions: [
        {
          id: "price-qual",
          statement: "Pricing impact band is heuristic until ARPU/packaging evidence is present.",
          source: "heuristic",
        },
      ],
      supportingEvidenceIds: [],
      status: "open",
    }),
  },
];

export function rankValueDrivers(input: {
  valuationInput: ValuationEstimateInput;
  estimate: ValuationEstimate;
  assessmentGoal: AssessmentGoalId;
}): ValueDriver[] {
  const drivers: ValueDriver[] = [];

  for (const spec of DRIVER_SPECS) {
    const built = spec.build({
      input: input.valuationInput,
      estimate: input.estimate,
    });
    if (!built) continue;
    if (built.impact.high <= 0 && built.currentMetric == null) {
      // Still include qualitative drivers with zero gap when estimate empty —
      // skip only if both impact and estimate are empty.
      if (input.estimate.currentRange.high <= 0) continue;
    }

    const goalW = driverGoalWeight(spec.key, input.assessmentGoal);
    const impactMid = mid(built.impact);
    const priority =
      impactMid * (built.confidence / 100) * goalW * (built.status === "open" ? 1 : 0.5);

    drivers.push({
      id: `vd-${spec.key}`,
      key: spec.key,
      title: spec.title,
      estimatedValueImpact: built.impact,
      confidence: built.confidence,
      difficulty: spec.difficulty,
      estimatedTime: spec.estimatedTime,
      requiredEvidence: spec.requiredEvidence,
      supportingEvidenceIds: built.supportingEvidenceIds,
      businessRationale: built.rationale,
      assumptions: built.assumptions,
      dependencies: spec.dependencies,
      status: built.status,
      currentMetric: built.currentMetric,
      targetMetric: spec.targetMetric,
      priority,
    });
  }

  return drivers.sort((a, b) => b.priority - a.priority);
}
