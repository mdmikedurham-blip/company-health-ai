/**
 * Transparent Enterprise Value Engine — Phase 11 domain types.
 * Ranges + assumptions + provenance + confidence. Never fabricated precision.
 */

import type { MoneyRange, ValuationMethodId, ValueAssumption } from "./value-navigator";

export type ValuationDiscountKind = "business" | "evidence";

export type ValuationDiscount = {
  id: string;
  kind: ValuationDiscountKind;
  title: string;
  impactRange: MoneyRange;
  rationale: string;
  confidence: number;
  supportingEvidenceIds: string[];
  assumptions: ValueAssumption[];
  /** What evidence or improvement would reduce/remove this discount. */
  whatWouldReduceIt: string;
};

export type ComparableBasis = {
  method: ValuationMethodId;
  sector: string;
  revenueMultipleBand: { low: number; high: number } | null;
  ebitdaMultipleBand: { low: number; high: number } | null;
  comps: Array<{ label: string; note: string }>;
  asOf: string;
  note: string;
};

export type PotentialValueScenario = {
  timeHorizonMonths: number;
  targetAssumptions: string[];
  requiredImprovements: string[];
  executionProbability: number;
  dependencies: string[];
  risks: string[];
  valueRange: MoneyRange;
};

export type EnterpriseValueEstimate = {
  available: boolean;
  unavailableReason: string | null;
  missingUnlockInput: string | null;
  currentEnterpriseValueRange: MoneyRange | null;
  potentialEnterpriseValueRange: MoneyRange | null;
  valueGapRange: MoneyRange | null;
  valuationConfidence: number;
  valuationMethod: ValuationMethodId | "unavailable";
  businessDiscountRange: MoneyRange | null;
  evidenceDiscountRange: MoneyRange | null;
  businessDiscounts: ValuationDiscount[];
  evidenceDiscounts: ValuationDiscount[];
  assumptions: ValueAssumption[];
  comparableBasis: ComparableBasis | null;
  potentialScenario: PotentialValueScenario | null;
  dataCompleteness: number;
  missingInputs: string[];
  snapshotId: string | null;
  generatedAt: string;
  /** Explainability chain — never fabricated. */
  provenance: {
    evidenceIds: string[];
    factKeys: string[];
    note: string;
  };
};

export type DoctorWhatChanged = {
  newFactsLearned: string[];
  hypothesesConfirmed: string[];
  hypothesesRejected: string[];
  confidenceBefore: number | null;
  confidenceAfter: number;
  confidenceDelta: number;
  valuationBeforeMid: number | null;
  valuationAfterMid: number | null;
  valuationDeltaNote: string;
  nextInvestigationTitle: string | null;
};

export type DoctorAlternativePath = {
  id: string;
  title: string;
  whyLowerPriority: string;
  estimatedValueImpact: MoneyRange | null;
};
