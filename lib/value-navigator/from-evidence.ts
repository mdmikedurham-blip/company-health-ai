/**
 * Build Value Navigator from evidence + goal (dashboard / API path).
 * Ranges are later overlaid by the transparent EV Opportunity engine
 * via `attachEnterpriseValueOpportunity` so this module stays cycle-free.
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  CompanyValueNavigator,
  ValueNavigatorView,
  ValueScenario,
  ValueScenarioKey,
} from "@/lib/domain/value-navigator";
import { rankValueDrivers } from "./drivers";
import { GOAL_VALUE_INTENT } from "./goal-weights";
import { valuationInputFromEvidence } from "./input-from-evidence";
import { clampPct, mid, moneyRange, valueGap } from "./money";
import { estimateEnterpriseValue } from "./providers/registry";
import { applyScenario } from "./scenarios";

function probabilityOfPotential(
  confidence: number,
  dataCompleteness: number,
): number {
  return clampPct(confidence * 0.55 + dataCompleteness * 0.25);
}

function formatImpact(range: { low: number; high: number }): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  return `${fmt(range.low)} to ${fmt(range.high)}`;
}

function doctorMessage(
  drivers: CompanyValueNavigator["drivers"],
): string {
  if (drivers.length < 2) {
    return "I will prioritize the highest expected enterprise-value creation once more evidence is available.";
  }
  const a = drivers[0]!;
  const b = drivers[1]!;
  return `I estimate improving ${a.title.toLowerCase()} could create substantially more enterprise value (${formatImpact(a.estimatedValueImpact)}) than focusing first on ${b.title.toLowerCase()} — so I will prioritize the highest expected value creation, not just health score.`;
}

export function buildNavigatorFromEvidence(input: {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  evidence: Evidence[];
  healthScore?: number | null;
  coverage?: number | null;
  prior?: {
    coverage: number | null;
    confidence: number | null;
    health: number | null;
    enterpriseValueMid: number | null;
  } | null;
  scenarioKeys?: ValueScenarioKey[];
}): ValueNavigatorView {
  const valuationInput = valuationInputFromEvidence({
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    assessmentGoal: input.assessmentGoal,
    evidence: input.evidence,
  });
  const estimate = estimateEnterpriseValue(valuationInput);
  const gap = valueGap(estimate.currentRange, estimate.potentialRange);
  const drivers = rankValueDrivers({
    valuationInput,
    estimate,
    assessmentGoal: input.assessmentGoal,
  });

  const generatedAt = new Date().toISOString();
  const top = drivers[0] ?? null;
  const evidenceDriver = drivers.find((d) => d.requiredEvidence.length > 0);

  const navigator: CompanyValueNavigator = {
    id: `vn-${input.companyId}-${input.snapshotId ?? "none"}`,
    companyId: input.companyId as CompanyValueNavigator["companyId"],
    snapshotId: input.snapshotId,
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
    evidenceRequest: evidenceDriver
      ? {
          label: `I can refine ${evidenceDriver.title.toLowerCase()} if you share: ${evidenceDriver.requiredEvidence[0]}.`,
          why: evidenceDriver.businessRationale,
          expectedValueImpact: evidenceDriver.estimatedValueImpact,
          expectedConfidenceIncrease: clampPct(
            12 + (100 - evidenceDriver.confidence) * 0.15,
          ),
          estimatedTime: evidenceDriver.estimatedTime,
        }
      : estimate.missingInputs.length > 0
        ? {
            label:
              "I can estimate enterprise value if you share a financial workbook with revenue and margin facts.",
            why: "Valuation plugins need at least one of revenue, EBITDA, or cash.",
            expectedValueImpact: null,
            expectedConfidenceIncrease: 40,
            estimatedTime: "15–30 minutes",
          }
        : null,
    highestRoiAction: top
      ? {
          title: top.title,
          rationale: `${GOAL_VALUE_INTENT[input.assessmentGoal]}: ${top.businessRationale}`,
          driverKey: top.key,
        }
      : null,
    doctorPriorityMessage: doctorMessage(drivers),
  };

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
          baseEstimate: estimate,
          key,
        });
      } catch {
        return null;
      }
    })
    .filter((s): s is ValueScenario => s != null);

  return {
    navigator,
    enterpriseValue: null,
    scenarios,
    timeline: [
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
        coverage: input.coverage ?? navigator.dataCompleteness,
        confidence: navigator.valuationConfidence,
        health: input.healthScore ?? null,
      },
    ],
    provenance: {
      companyId: input.companyId,
      snapshotId: navigator.snapshotId,
      generatedAt: navigator.generatedAt,
      valuationMethod: navigator.valuationMethod,
    },
  };
}

export { moneyRange };
