/**
 * Company Value Navigator — Phase 10 domain types.
 * Ranges + confidence + assumptions only — never fabricated precision.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { EnterpriseValueEstimate } from "./enterprise-value";
import type { CompanyId } from "./primitives";

export type MoneyRange = {
  low: number;
  high: number;
  currency: "USD";
};

export type ValuationMethodId =
  | "market-multiples"
  | "income-heuristic"
  | "asset-heuristic"
  | "rule-based"
  | "ml-future";

export type ValueDriverKey =
  | "customer-concentration"
  | "recurring-revenue"
  | "gross-margin"
  | "cash-runway"
  | "revenue-growth"
  | "governance"
  | "soc2"
  | "leadership"
  | "sales-efficiency"
  | "product-execution"
  | "pricing";

export type ValueDriverDifficulty = "low" | "medium" | "high";
export type ValueDriverStatus = "open" | "in_progress" | "done" | "blocked";

export type ValueAssumption = {
  id: string;
  statement: string;
  source: "profile" | "evidence" | "heuristic" | "scenario";
};

export type ValueDriver = {
  id: string;
  key: ValueDriverKey;
  title: string;
  estimatedValueImpact: MoneyRange;
  confidence: number;
  difficulty: ValueDriverDifficulty;
  estimatedTime: string;
  requiredEvidence: string[];
  supportingEvidenceIds: string[];
  businessRationale: string;
  assumptions: ValueAssumption[];
  dependencies: string[];
  status: ValueDriverStatus;
  currentMetric: string | null;
  targetMetric: string | null;
  priority: number;
};

export type ValueScenarioKey =
  | "increase-revenue-growth"
  | "improve-gross-margin"
  | "reduce-churn"
  | "increase-nrr"
  | "reduce-burn"
  | "raise-capital"
  | "hire-vp-sales"
  | "launch-new-product"
  | "acquire-company"
  | "improve-governance"
  | "complete-soc2"
  | "reduce-concentration";

export type ValueScenario = {
  id: string;
  key: ValueScenarioKey;
  name: string;
  parameters: Record<string, number | string | boolean>;
  estimatedEnterpriseValue: MoneyRange;
  confidence: number;
  majorRisks: string[];
  recommendedActions: string[];
  assumptions: ValueAssumption[];
  /** Always true — scenarios never mutate assessment SSOT. */
  isolatedFromAssessment: true;
};

export type CompanyValueNavigator = {
  id: string;
  companyId: CompanyId;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId | string | null;
  valuationMethod: ValuationMethodId;
  currentEstimatedEnterpriseValueRange: MoneyRange;
  potentialEnterpriseValueRange: MoneyRange;
  /** Enterprise Value Opportunity (potential − current). */
  enterpriseValueOpportunity: MoneyRange;
  /** @deprecated Prefer enterpriseValueOpportunity */
  valueGap: MoneyRange;
  probabilityOfAchievingPotential: number;
  valuationConfidence: number;
  assumptions: ValueAssumption[];
  dataCompleteness: number;
  missingInputs: string[];
  generatedAt: string;
  drivers: ValueDriver[];
  evidenceRequest: {
    label: string;
    why: string;
    expectedValueImpact: MoneyRange | null;
    expectedConfidenceIncrease: number;
    estimatedTime: string;
  } | null;
  highestRoiAction: {
    title: string;
    rationale: string;
    driverKey: ValueDriverKey | null;
  } | null;
  doctorPriorityMessage: string;
};

export type ValueNavigatorView = {
  navigator: CompanyValueNavigator;
  /**
   * Transparent EV Opportunity model (ranges + discounts + missing evidence).
   * Source of truth for dashboard Enterprise Value Opportunity card.
   */
  enterpriseValue: EnterpriseValueEstimate | null;
  scenarios: ValueScenario[];
  timeline: Array<{
    label: string;
    enterpriseValueMid: number | null;
    coverage: number | null;
    confidence: number;
    health: number | null;
  }>;
  provenance: {
    companyId: string;
    snapshotId: string | null;
    generatedAt: string;
    valuationMethod: ValuationMethodId;
  };
};

export type ValuationEstimateInput = {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  revenue: number | null;
  ebitda: number | null;
  cash: number | null;
  growthRate: number | null;
  grossMargin: number | null;
  churnRate: number | null;
  nrr: number | null;
  top3CustomerArrShare: number | null;
  recurringRevenueShare: number | null;
  cashRunwayMonths: number | null;
  evidenceIds: string[];
};

export type ValuationEstimate = {
  method: ValuationMethodId;
  currentRange: MoneyRange;
  potentialRange: MoneyRange;
  confidence: number;
  dataCompleteness: number;
  assumptions: ValueAssumption[];
  missingInputs: string[];
};

export type ValuationProvider = {
  id: ValuationMethodId;
  label: string;
  estimate: (input: ValuationEstimateInput) => ValuationEstimate;
};
