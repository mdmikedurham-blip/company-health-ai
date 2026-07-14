/**
 * Build Company Value Navigator from snapshot + assessment goal.
 */

import type { CompanyHealthSnapshot } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  CompanyValueNavigator,
  ValueNavigatorView,
  ValueScenario,
  ValueScenarioKey,
} from "@/lib/domain/value-navigator";
import { rankValueDrivers } from "./drivers";
import { GOAL_VALUE_INTENT } from "./goal-weights";
import { valuationInputFromSnapshot } from "./input-from-snapshot";
import { clampPct, mid, moneyRange, valueGap } from "./money";
import { estimateEnterpriseValue } from "./providers/registry";
import { applyScenario, listScenarioCatalog } from "./scenarios";

function probabilityOfPotential(
  confidence: number,
  dataCompleteness: number,
): number {
  return clampPct(confidence * 0.55 + dataCompleteness * 0.25);
}

function pickEvidenceRequest(
  navigator: Omit<
    CompanyValueNavigator,
    "evidenceRequest" | "highestRoiAction" | "doctorPriorityMessage"
  > & {
    drivers: CompanyValueNavigator["drivers"];
  },
): CompanyValueNavigator["evidenceRequest"] {
  const top = navigator.drivers.find((d) => d.requiredEvidence.length > 0);
  if (!top) return null;
  return {
    label: `I can refine ${top.title.toLowerCase()} if you share: ${top.requiredEvidence[0]}.`,
    why: top.businessRationale,
    expectedValueImpact: top.estimatedValueImpact,
    expectedConfidenceIncrease: clampPct(12 + (100 - top.confidence) * 0.15),
    estimatedTime: top.estimatedTime,
  };
}

function doctorMessage(drivers: CompanyValueNavigator["drivers"]): string {
  if (drivers.length < 2) {
    return "I will prioritize the highest expected enterprise-value creation once more evidence is available.";
  }
  const a = drivers[0]!;
  const b = drivers[1]!;
  return `I estimate improving ${a.title.toLowerCase()} could create substantially more enterprise value (${formatImpact(a.estimatedValueImpact)}) than focusing first on ${b.title.toLowerCase()} — so I will prioritize the higher expected value creation, not just health score.`;
}

function formatImpact(range: { low: number; high: number }): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  return `${fmt(range.low)} to ${fmt(range.high)}`;
}

export function buildCompanyValueNavigator(input: {
  companyId: string;
  snapshot: CompanyHealthSnapshot;
  assessmentGoal: AssessmentGoalId;
  navigatorId?: string;
}): CompanyValueNavigator {
  const valuationInput = valuationInputFromSnapshot({
    companyId: input.companyId,
    snapshot: input.snapshot,
    assessmentGoal: input.assessmentGoal,
  });
  const estimate = estimateEnterpriseValue(valuationInput);
  const gap = valueGap(estimate.currentRange, estimate.potentialRange);
  const drivers = rankValueDrivers({
    valuationInput,
    estimate,
    assessmentGoal: input.assessmentGoal,
  });

  const generatedAt = new Date().toISOString();
  const snapshotId = input.snapshot.assessmentSnapshotId ?? null;
  const base = {
    id: input.navigatorId ?? `vn-${input.companyId}-${snapshotId ?? "none"}`,
    companyId: input.companyId as CompanyValueNavigator["companyId"],
    snapshotId,
    assessmentGoal: input.assessmentGoal,
    valuationMethod: estimate.method,
    currentEstimatedEnterpriseValueRange: estimate.currentRange,
    potentialEnterpriseValueRange: estimate.potentialRange,
    enterpriseValueOpportunity: gap,
    valueGap: gap,
    probabilityOfAchievingPotential: probabilityOfPotential(
      estimate.confidence,
      estimate.dataCompleteness,
    ),
    valuationConfidence: estimate.confidence,
    assumptions: estimate.assumptions,
    dataCompleteness: estimate.dataCompleteness,
    missingInputs: estimate.missingInputs,
    generatedAt,
    drivers,
  };

  const evidenceRequest = pickEvidenceRequest(base);
  const top = drivers[0] ?? null;

  return {
    ...base,
    evidenceRequest,
    highestRoiAction: top
      ? {
          title: top.title,
          rationale: `${GOAL_VALUE_INTENT[input.assessmentGoal]}: ${top.businessRationale}`,
          driverKey: top.key,
        }
      : null,
    doctorPriorityMessage: doctorMessage(drivers),
  };
}

export function buildValueNavigatorView(input: {
  companyId: string;
  snapshot: CompanyHealthSnapshot;
  assessmentGoal: AssessmentGoalId;
  scenarioKeys?: ValueScenarioKey[];
  prior?: {
    coverage: number | null;
    confidence: number | null;
    health: number | null;
    enterpriseValueMid: number | null;
  } | null;
}): ValueNavigatorView {
  const navigator = buildCompanyValueNavigator({
    companyId: input.companyId,
    snapshot: input.snapshot,
    assessmentGoal: input.assessmentGoal,
  });

  const valuationInput = valuationInputFromSnapshot({
    companyId: input.companyId,
    snapshot: input.snapshot,
    assessmentGoal: input.assessmentGoal,
  });
  const baseEstimate = estimateEnterpriseValue(valuationInput);

  const keys =
    input.scenarioKeys ??
    ([
      "reduce-concentration",
      "increase-revenue-growth",
      "improve-gross-margin",
    ] as ValueScenarioKey[]);

  const scenarios: ValueScenario[] = keys
    .map((key) => {
      try {
        return applyScenario({
          baseInput: valuationInput,
          baseEstimate,
          key,
        });
      } catch {
        return null;
      }
    })
    .filter((s): s is ValueScenario => s != null);

  const timeline = [
    {
      label: "Prior",
      enterpriseValueMid: input.prior?.enterpriseValueMid ?? null,
      coverage: input.prior?.coverage ?? null,
      confidence: input.prior?.confidence ?? 0,
      health: input.prior?.health ?? null,
    },
    {
      label: "Current",
      enterpriseValueMid: mid(navigator.currentEstimatedEnterpriseValueRange),
      coverage: navigator.dataCompleteness,
      confidence: navigator.valuationConfidence,
      health: input.snapshot.healthScore?.score ?? null,
    },
  ];

  return {
    navigator,
    enterpriseValue: null,
    scenarios,
    timeline,
    provenance: {
      companyId: input.companyId,
      snapshotId: navigator.snapshotId,
      generatedAt: navigator.generatedAt,
      valuationMethod: navigator.valuationMethod,
    },
  };
}

export function emptyValueNavigator(companyId: string): CompanyValueNavigator {
  const generatedAt = new Date().toISOString();
  return {
    id: `vn-empty-${companyId}`,
    companyId: companyId as CompanyValueNavigator["companyId"],
    snapshotId: null,
    assessmentGoal: null,
    valuationMethod: "rule-based",
    currentEstimatedEnterpriseValueRange: moneyRange(0, 0),
    potentialEnterpriseValueRange: moneyRange(0, 0),
    enterpriseValueOpportunity: moneyRange(0, 0),
    valueGap: moneyRange(0, 0),
    probabilityOfAchievingPotential: 0,
    valuationConfidence: 0,
    assumptions: [
      {
        id: "empty",
        statement: "No assessment snapshot yet — value ranges unavailable.",
        source: "heuristic",
      },
    ],
    dataCompleteness: 0,
    missingInputs: ["revenue", "ebitda", "cashBalance"],
    generatedAt,
    drivers: [],
    evidenceRequest: {
      label:
        "I can estimate enterprise value if you share a financial workbook with revenue and margin facts.",
      why: "Valuation plugins need at least one of revenue, EBITDA, or cash.",
      expectedValueImpact: null,
      expectedConfidenceIncrease: 40,
      estimatedTime: "15–30 minutes",
    },
    highestRoiAction: null,
    doctorPriorityMessage:
      "Share financial evidence so I can prioritize the highest expected value creation.",
  };
}

export { listScenarioCatalog };
