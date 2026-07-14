/**
 * Transparent Enterprise Value Engine — Phase 11 domain types.
 * Ranges + assumptions + provenance + confidence. Never fabricated precision.
 */

import type { MoneyRange, ValuationMethodId, ValueAssumption } from "./value-navigator";

export type ValuationDiscountKind = "business" | "evidence";

export type ValuationDiscountEvidenceStatus = "supporting" | "missing";

export type ValuationDiscount = {
  id: string;
  kind: ValuationDiscountKind;
  title: string;
  /** Estimated value impact range (reduction to current EV). */
  impactRange: MoneyRange;
  /** Explanation of why this discount applies. */
  rationale: string;
  confidence: number;
  supportingEvidenceIds: string[];
  /** Human-readable evidence status for the discount line. */
  evidenceStatus: ValuationDiscountEvidenceStatus;
  /** Evidence supporting the discount, or exactly what is missing. */
  evidenceSummary: string;
  assumptions: ValueAssumption[];
  /** What evidence or improvement would reduce/remove this discount. */
  whatWouldReduceIt: string;
  /** Recommended next action to reduce this discount. */
  recommendedNextAction: string;
};

/** Missing evidence that most reduces valuation uncertainty when supplied. */
export type MissingEvidencePriority = {
  key: string;
  label: string;
  why: string;
  estimatedConfidenceGain: number;
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
  /** Estimated Enterprise Value Today (range). */
  currentEnterpriseValueRange: MoneyRange | null;
  /** Potential Enterprise Value (range). */
  potentialEnterpriseValueRange: MoneyRange | null;
  /**
   * Enterprise Value Opportunity — potential minus current (range).
   * Alias of valueGapRange for product naming.
   */
  enterpriseValueOpportunityRange: MoneyRange | null;
  /** @deprecated Prefer enterpriseValueOpportunityRange */
  valueGapRange: MoneyRange | null;
  /** Confidence score 0–100. */
  valuationConfidence: number;
  valuationMethod: ValuationMethodId | "unavailable";
  businessDiscountRange: MoneyRange | null;
  evidenceDiscountRange: MoneyRange | null;
  businessDiscounts: ValuationDiscount[];
  evidenceDiscounts: ValuationDiscount[];
  /** Unified discount list for UI (business then evidence). */
  discounts: ValuationDiscount[];
  /** Missing evidence ranked by uncertainty reduction. */
  missingEvidencePriorities: MissingEvidencePriority[];
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
