/**
 * Scenario engine — what-if overlays that never overwrite the current assessment.
 */

import type {
  MoneyRange,
  ValuationEstimate,
  ValuationEstimateInput,
  ValueAssumption,
  ValueScenario,
  ValueScenarioKey,
} from "@/lib/domain/value-navigator";
import { estimateEnterpriseValue } from "./providers/registry";
import { clampPct, moneyRange } from "./money";

export type ScenarioDefinition = {
  key: ValueScenarioKey;
  name: string;
  description: string;
  apply: (input: ValuationEstimateInput) => {
    next: ValuationEstimateInput;
    assumptions: ValueAssumption[];
    majorRisks: string[];
    recommendedActions: string[];
  };
};

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    key: "increase-revenue-growth",
    name: "Increase revenue growth",
    description: "Lift YoY growth toward a stronger multiple band.",
    apply: (input) => ({
      next: {
        ...input,
        growthRate: Math.max(input.growthRate ?? 0, 0.4),
      },
      assumptions: [
        {
          id: "sc-growth",
          statement: "Scenario assumes sustained ~40% YoY growth is achievable.",
          source: "scenario",
        },
      ],
      majorRisks: ["Growth plan may require more burn or sales capacity."],
      recommendedActions: ["Validate pipeline coverage and CAC payback."],
    }),
  },
  {
    key: "improve-gross-margin",
    name: "Improve gross margin",
    description: "Raise gross margin toward software-quality band.",
    apply: (input) => ({
      next: {
        ...input,
        grossMargin: Math.max(input.grossMargin ?? 0, 0.75),
      },
      assumptions: [
        {
          id: "sc-gm",
          statement: "Scenario assumes gross margin reaches ~75%.",
          source: "scenario",
        },
      ],
      majorRisks: ["Cost cuts may hurt product quality or support."],
      recommendedActions: ["Build a margin bridge by cost bucket."],
    }),
  },
  {
    key: "reduce-churn",
    name: "Reduce churn",
    description: "Lower logo/revenue churn.",
    apply: (input) => ({
      next: {
        ...input,
        churnRate: Math.min(input.churnRate ?? 0.1, 0.05),
        nrr: Math.max(input.nrr ?? 1, 1.05),
      },
      assumptions: [
        {
          id: "sc-churn",
          statement: "Scenario assumes churn ≤5% and NRR ≥105%.",
          source: "scenario",
        },
      ],
      majorRisks: ["Retention gains may lag investment in CS."],
      recommendedActions: ["Prioritize top churn cohorts."],
    }),
  },
  {
    key: "increase-nrr",
    name: "Increase NRR",
    description: "Expand net revenue retention.",
    apply: (input) => ({
      next: {
        ...input,
        nrr: Math.max(input.nrr ?? 1, 1.2),
      },
      assumptions: [
        {
          id: "sc-nrr",
          statement: "Scenario assumes NRR reaches ~120%.",
          source: "scenario",
        },
      ],
      majorRisks: ["Expansion requires packaging and success capacity."],
      recommendedActions: ["Map expansion motions by segment."],
    }),
  },
  {
    key: "reduce-burn",
    name: "Reduce burn",
    description: "Extend runway via lower burn.",
    apply: (input) => ({
      next: {
        ...input,
        cashRunwayMonths: Math.max(input.cashRunwayMonths ?? 0, 18),
      },
      assumptions: [
        {
          id: "sc-burn",
          statement: "Scenario assumes runway extends to ≥18 months.",
          source: "scenario",
        },
      ],
      majorRisks: ["Cuts may slow growth."],
      recommendedActions: ["Identify non-growth OpEx to trim first."],
    }),
  },
  {
    key: "raise-capital",
    name: "Raise capital",
    description: "Inject cash and extend runway.",
    apply: (input) => ({
      next: {
        ...input,
        cash: (input.cash ?? 0) + (input.revenue ?? 1_000_000) * 0.5,
        cashRunwayMonths: Math.max(input.cashRunwayMonths ?? 0, 24),
      },
      assumptions: [
        {
          id: "sc-raise",
          statement: "Scenario assumes a raise ~0.5× revenue with dilution/terms not modeled.",
          source: "scenario",
        },
      ],
      majorRisks: ["Dilution and terms can offset headline cash benefit."],
      recommendedActions: ["Prepare investor narrative around value gap drivers."],
    }),
  },
  {
    key: "hire-vp-sales",
    name: "Hire VP Sales",
    description: "Leadership hire to unlock growth execution.",
    apply: (input) => ({
      next: {
        ...input,
        growthRate: Math.max(input.growthRate ?? 0, (input.growthRate ?? 0.15) + 0.1),
      },
      assumptions: [
        {
          id: "sc-vp",
          statement: "Scenario assumes VP Sales adds ~10pp growth over time (illustrative).",
          source: "scenario",
        },
      ],
      majorRisks: ["Hire cost and ramp risk."],
      recommendedActions: ["Define 90-day scorecard before hire."],
    }),
  },
  {
    key: "launch-new-product",
    name: "Launch new product",
    description: "New product expands addressable growth.",
    apply: (input) => ({
      next: {
        ...input,
        growthRate: Math.max(input.growthRate ?? 0, 0.35),
        revenue: input.revenue != null ? input.revenue * 1.1 : input.revenue,
      },
      assumptions: [
        {
          id: "sc-product",
          statement: "Scenario assumes +10% revenue and stronger growth from a new product (illustrative).",
          source: "scenario",
        },
      ],
      majorRisks: ["Cannibalization and execution risk."],
      recommendedActions: ["Validate willingness-to-pay before full build."],
    }),
  },
  {
    key: "acquire-company",
    name: "Acquire company",
    description: "Inorganic growth via acquisition.",
    apply: (input) => ({
      next: {
        ...input,
        revenue: input.revenue != null ? input.revenue * 1.25 : input.revenue,
      },
      assumptions: [
        {
          id: "sc-acq",
          statement: "Scenario assumes +25% revenue; integration costs and purchase price not netted.",
          source: "scenario",
        },
      ],
      majorRisks: ["Integration failure and overpayment."],
      recommendedActions: ["Diligence retention and product overlap."],
    }),
  },
  {
    key: "improve-governance",
    name: "Improve governance",
    description: "Board cadence and controls.",
    apply: (input) => ({
      next: { ...input },
      assumptions: [
        {
          id: "sc-gov",
          statement: "Governance scenario does not change financial inputs; confidence rises slightly.",
          source: "scenario",
        },
      ],
      majorRisks: ["Process without substance."],
      recommendedActions: ["Install monthly board pack and decision log."],
    }),
  },
  {
    key: "complete-soc2",
    name: "Complete SOC2",
    description: "Enterprise trust unlock.",
    apply: (input) => ({
      next: {
        ...input,
        growthRate: Math.max(input.growthRate ?? 0, (input.growthRate ?? 0.2) + 0.05),
      },
      assumptions: [
        {
          id: "sc-soc2",
          statement: "Scenario assumes SOC2 enables modest growth uplift via enterprise deals.",
          source: "scenario",
        },
      ],
      majorRisks: ["Audit cost and timeline slip."],
      recommendedActions: ["Map enterprise pipeline blocked on SOC2."],
    }),
  },
  {
    key: "reduce-concentration",
    name: "Reduce customer concentration",
    description: "Diversify top-customer ARR share.",
    apply: (input) => ({
      next: {
        ...input,
        top3CustomerArrShare: Math.min(input.top3CustomerArrShare ?? 0.4, 0.2),
      },
      assumptions: [
        {
          id: "sc-conc",
          statement: "Scenario assumes top-3 concentration falls to ≤20%.",
          source: "scenario",
        },
      ],
      majorRisks: ["Diversification may slow near-term revenue."],
      recommendedActions: ["Hire/expand mid-market motion."],
    }),
  },
];

export function getScenarioDefinition(
  key: ValueScenarioKey,
): ScenarioDefinition | null {
  return SCENARIO_CATALOG.find((s) => s.key === key) ?? null;
}

/**
 * Apply a scenario to a copy of valuation inputs.
 * Returns an isolated scenario result — never mutates the base estimate SSOT.
 */
export function applyScenario(input: {
  baseInput: ValuationEstimateInput;
  baseEstimate: ValuationEstimate;
  key: ValueScenarioKey;
  id?: string;
}): ValueScenario {
  const def = getScenarioDefinition(input.key);
  if (!def) {
    throw new Error(`Unknown scenario: ${input.key}`);
  }

  const applied = def.apply({ ...input.baseInput });
  const estimate = estimateEnterpriseValue(applied.next);

  // Governance-only: bump confidence slightly without claiming EV change from thin air.
  let confidence = estimate.confidence;
  let estimatedEnterpriseValue: MoneyRange = estimate.currentRange;
  if (input.key === "improve-governance") {
    confidence = clampPct(input.baseEstimate.confidence + 5);
    estimatedEnterpriseValue = moneyRange(
      input.baseEstimate.currentRange.low,
      input.baseEstimate.currentRange.high,
    );
  }

  return {
    id: input.id ?? `scenario-${input.key}`,
    key: input.key,
    name: def.name,
    parameters: {},
    estimatedEnterpriseValue,
    confidence,
    majorRisks: applied.majorRisks,
    recommendedActions: applied.recommendedActions,
    assumptions: [
      ...applied.assumptions,
      {
        id: "sc-isolated",
        statement:
          "This scenario is isolated from the current assessment and does not overwrite snapshot SSOT.",
        source: "scenario",
      },
    ],
    isolatedFromAssessment: true,
  };
}

export function listScenarioCatalog(): Array<{
  key: ValueScenarioKey;
  name: string;
  description: string;
}> {
  return SCENARIO_CATALOG.map((s) => ({
    key: s.key,
    name: s.name,
    description: s.description,
  }));
}
