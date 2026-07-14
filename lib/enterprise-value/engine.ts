/**
 * Transparent Enterprise Value Opportunity Engine (v1).
 * Wraps Phase 10 valuation plugins with business vs evidence discounts.
 * Demo safety: no valuation when required financial inputs are absent.
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  ComparableBasis,
  EnterpriseValueEstimate,
  MissingEvidencePriority,
  PotentialValueScenario,
  ValuationDiscount,
} from "@/lib/domain/enterprise-value";
import type {
  MoneyRange,
  ValuationEstimate,
  ValuationEstimateInput,
  ValueAssumption,
} from "@/lib/domain/value-navigator";
import { valuationInputFromEvidence } from "@/lib/value-navigator/input-from-evidence";
import {
  moneyRange,
  mid,
  valueGap,
  widenRangeForConfidence,
  clampPct,
} from "@/lib/value-navigator/money";
import { estimateEnterpriseValue } from "@/lib/value-navigator/providers/registry";

const DEFAULT_HORIZON_MONTHS = 36;

/** Minimum for any preliminary valuation — at least one of these. */
export const MIN_VALUATION_INPUTS = [
  "revenue",
  "ebitda",
  "cashBalance",
] as const;

function emptyRange(): MoneyRange {
  return moneyRange(0, 0);
}

function sumRanges(ranges: MoneyRange[]): MoneyRange | null {
  if (ranges.length === 0) return null;
  return moneyRange(
    ranges.reduce((s, r) => s + r.low, 0),
    ranges.reduce((s, r) => s + r.high, 0),
  );
}

function applyDiscount(
  base: MoneyRange,
  discount: MoneyRange | null,
): MoneyRange {
  if (!discount) return base;
  return moneyRange(
    Math.max(0, base.low - discount.high),
    Math.max(0, base.high - discount.low),
  );
}

function buildComparableBasis(
  estimate: ValuationEstimate,
  generatedAt: string,
): ComparableBasis {
  const isMarket = estimate.method === "market-multiples";
  const isIncome = estimate.method === "income-heuristic";
  return {
    method: estimate.method,
    sector: "Private SaaS / software (heuristic band)",
    revenueMultipleBand: isMarket ? { low: 4, high: 8 } : null,
    ebitdaMultipleBand: isIncome ? { low: 8, high: 14 } : null,
    comps: [
      {
        label: "Heuristic multiple band",
        note: "Not a live market quote — documented assumption only.",
      },
    ],
    asOf: generatedAt,
    note: "Comparable basis is rule-based until an external-comps provider is wired.",
  };
}

function evidenceSummaryPresent(
  evidenceIds: string[],
  factLabel: string,
): Pick<
  ValuationDiscount,
  "evidenceStatus" | "evidenceSummary" | "supportingEvidenceIds"
> {
  return {
    evidenceStatus: "supporting",
    evidenceSummary:
      evidenceIds.length > 0
        ? `Supported by extracted ${factLabel} on ${evidenceIds.length} evidence item${evidenceIds.length === 1 ? "" : "s"}.`
        : `Supported by extracted ${factLabel} (evidence id not linked).`,
    supportingEvidenceIds: evidenceIds.slice(0, 3),
  };
}

function evidenceSummaryMissing(what: string): Pick<
  ValuationDiscount,
  "evidenceStatus" | "evidenceSummary" | "supportingEvidenceIds"
> {
  return {
    evidenceStatus: "missing",
    evidenceSummary: `Missing evidence: ${what}`,
    supportingEvidenceIds: [],
  };
}

/**
 * Business discounts — actual company weakness from observed facts.
 * Do not double-count into evidence discounts.
 */
export function computeBusinessDiscounts(
  input: ValuationEstimateInput,
  raw: ValuationEstimate,
): ValuationDiscount[] {
  const discounts: ValuationDiscount[] = [];
  const baseMid = mid(raw.currentRange);
  if (baseMid <= 0) return discounts;
  const ids = input.evidenceIds;

  if (
    input.top3CustomerArrShare != null &&
    input.top3CustomerArrShare >= 0.35
  ) {
    const pct = (input.top3CustomerArrShare * 100).toFixed(0);
    const next =
      "Diversify ARR so top-3 customers are ≤20% of revenue (share customer ARR export to track progress).";
    discounts.push({
      id: "biz-concentration",
      kind: "business",
      title: "Customer concentration",
      impactRange: moneyRange(baseMid * 0.05, baseMid * 0.15),
      rationale: `Top-3 concentration is ${pct}%. Buyers and investors typically apply a risk discount when revenue depends on a few accounts.`,
      confidence: 70,
      ...evidenceSummaryPresent(ids, "top-3 customer ARR share"),
      assumptions: [
        {
          id: "biz-conc-band",
          statement: "Concentration discount uses a 5–15% of mid-EV heuristic band.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.growthRate != null && input.growthRate < 0.1) {
    const next =
      "Sustainably raise revenue growth toward ≥25% YoY and upload the ARR trend workbook.";
    discounts.push({
      id: "biz-low-growth",
      kind: "business",
      title: "Low revenue growth",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Observed growth ${(input.growthRate * 100).toFixed(0)}% is below a typical growth-stage band, which compresses multiples.`,
      confidence: 65,
      ...evidenceSummaryPresent(ids, "revenue growth"),
      assumptions: [
        {
          id: "biz-growth",
          statement: "Low-growth discount applies when YoY growth is below 10%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.cashRunwayMonths != null && input.cashRunwayMonths < 12) {
    const next =
      "Extend runway to ≥12 months via burn reduction or capital; share an updated cash/burn workbook.";
    discounts.push({
      id: "biz-runway",
      kind: "business",
      title: "Short cash runway",
      impactRange: moneyRange(baseMid * 0.06, baseMid * 0.18),
      rationale: `Runway is ${input.cashRunwayMonths} months. Short runway forces distressed decisions and reduces negotiation leverage.`,
      confidence: 75,
      ...evidenceSummaryPresent(ids, "cash runway"),
      assumptions: [
        {
          id: "biz-runway",
          statement: "Runway discount applies when cash runway is under 12 months.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.churnRate != null && input.churnRate >= 0.08) {
    const next =
      "Reduce churn toward ≤4% with retention programs; share a churn or cohort retention report.";
    discounts.push({
      id: "biz-churn",
      kind: "business",
      title: "Elevated churn",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Churn at ${(input.churnRate * 100).toFixed(0)}% weakens recurring cash-flow quality.`,
      confidence: 60,
      ...evidenceSummaryPresent(ids, "churn rate"),
      assumptions: [
        {
          id: "biz-churn",
          statement: "Churn discount applies when churn ≥8%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.grossMargin != null && input.grossMargin < 0.6) {
    const next =
      "Improve gross margin toward ≥70%; share a COGS / unit-economics workbook.";
    discounts.push({
      id: "biz-margin",
      kind: "business",
      title: "Gross margin below software quality band",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.1),
      rationale: `Gross margin ${(input.grossMargin * 100).toFixed(0)}% is below a typical software quality band.`,
      confidence: 55,
      ...evidenceSummaryPresent(ids, "gross margin"),
      assumptions: [
        {
          id: "biz-gm",
          statement: "Margin discount applies when gross margin is below 60%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  return discounts;
}

/**
 * Evidence discounts — uncertainty from missing or incomplete evidence.
 * Never double-count issues already covered as business discounts.
 */
export function computeEvidenceDiscounts(
  input: ValuationEstimateInput,
  raw: ValuationEstimate,
  businessIds: Set<string>,
): ValuationDiscount[] {
  const discounts: ValuationDiscount[] = [];
  const baseMid = mid(raw.currentRange);
  if (baseMid <= 0) return discounts;

  if (input.top3CustomerArrShare == null && !businessIds.has("biz-concentration")) {
    const next = "Share a customer revenue / ARR-by-account export.";
    discounts.push({
      id: "ev-missing-concentration",
      kind: "evidence",
      title: "No customer-level revenue data",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.1),
      rationale:
        "Without a customer revenue export, concentration risk cannot be measured — the estimate is discounted for uncertainty.",
      confidence: 50,
      ...evidenceSummaryMissing("customer revenue / ARR-by-account export"),
      assumptions: [
        {
          id: "ev-conc",
          statement: "Missing concentration fact widens uncertainty discount.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.churnRate == null && input.nrr == null && !businessIds.has("biz-churn")) {
    const next = "Share a churn report or NRR cohort workbook.";
    discounts.push({
      id: "ev-missing-retention",
      kind: "evidence",
      title: "No churn or cohort retention data",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.09),
      rationale:
        "Retention quality is unknown. The estimate is discounted until churn or NRR evidence arrives.",
      confidence: 45,
      ...evidenceSummaryMissing("churn report or NRR cohort workbook"),
      assumptions: [
        {
          id: "ev-ret",
          statement: "Missing churn/NRR applies an evidence discount only.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.growthRate == null && !businessIds.has("biz-low-growth")) {
    const next = "Share ARR trend or YoY growth in a financial workbook.";
    discounts.push({
      id: "ev-missing-growth",
      kind: "evidence",
      title: "Incomplete growth history",
      impactRange: moneyRange(baseMid * 0.02, baseMid * 0.08),
      rationale:
        "Revenue growth is not observed in the current snapshot — multiple selection is less certain.",
      confidence: 40,
      ...evidenceSummaryMissing("ARR trend or YoY growth facts"),
      assumptions: [
        {
          id: "ev-growth",
          statement:
            "Missing growth fact applies evidence discount, not a business weakness claim.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (input.cashRunwayMonths == null && !businessIds.has("biz-runway")) {
    const next = "Share a cash / burn workbook with runway.";
    discounts.push({
      id: "ev-missing-runway",
      kind: "evidence",
      title: "No cash runway evidence",
      impactRange: moneyRange(baseMid * 0.02, baseMid * 0.07),
      rationale:
        "Runway is unknown. Liquidity risk cannot be ruled out from the current evidence.",
      confidence: 40,
      ...evidenceSummaryMissing("cash / burn workbook with runway"),
      assumptions: [
        {
          id: "ev-runway",
          statement:
            "Missing runway is an evidence gap, not an asserted short-runway finding.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  if (raw.dataCompleteness < 50) {
    const next =
      "Add revenue, margin, growth, retention, and cash facts from one current workbook.";
    discounts.push({
      id: "ev-incomplete",
      kind: "evidence",
      title: "Incomplete financial evidence",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Data completeness is ${raw.dataCompleteness}%. The estimate remains preliminary until more financial facts are present.`,
      confidence: 55,
      evidenceStatus: "missing",
      evidenceSummary: `Missing evidence: financial completeness is ${raw.dataCompleteness}% (need ≥50%).`,
      supportingEvidenceIds: input.evidenceIds.slice(0, 2),
      assumptions: [
        {
          id: "ev-complete",
          statement: "Broad incompleteness discount when data completeness < 50%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: next,
      recommendedNextAction: next,
    });
  }

  return discounts;
}

export function rankMissingEvidencePriorities(
  evidenceDiscounts: ValuationDiscount[],
): MissingEvidencePriority[] {
  return evidenceDiscounts
    .filter((d) => d.evidenceStatus === "missing")
    .map((d) => ({
      key: d.id,
      label: d.title,
      why: d.rationale,
      estimatedConfidenceGain: clampPct(8 + (100 - d.confidence) * 0.12),
    }))
    .sort((a, b) => b.estimatedConfidenceGain - a.estimatedConfidenceGain)
    .slice(0, 5);
}

function buildPotentialScenario(
  adjustedPotential: MoneyRange,
  business: ValuationDiscount[],
): PotentialValueScenario {
  return {
    timeHorizonMonths: DEFAULT_HORIZON_MONTHS,
    targetAssumptions: [
      "Execute the top value drivers over a 36-month horizon",
      "Hold the same valuation method band while improving operating quality",
    ],
    requiredImprovements: business.map((d) => d.recommendedNextAction).slice(0, 5),
    executionProbability: clampPct(55 - business.length * 5),
    dependencies: ["Leadership capacity", "Capital availability", "Evidence quality"],
    risks: business.map((d) => d.title).slice(0, 4),
    valueRange: adjustedPotential,
  };
}

function unavailableEstimate(input: {
  snapshotId: string | null;
  generatedAt: string;
  unlock: string;
  evidenceIds: string[];
}): EnterpriseValueEstimate {
  return {
    available: false,
    unavailableReason:
      "Preliminary valuation unavailable — required financial inputs are not present in the current snapshot.",
    missingUnlockInput: input.unlock,
    currentEnterpriseValueRange: null,
    potentialEnterpriseValueRange: null,
    enterpriseValueOpportunityRange: null,
    valueGapRange: null,
    valuationConfidence: 0,
    valuationMethod: "unavailable",
    businessDiscountRange: null,
    evidenceDiscountRange: null,
    businessDiscounts: [],
    evidenceDiscounts: [],
    discounts: [],
    missingEvidencePriorities: [
      {
        key: `unlock-${input.unlock}`,
        label: `Share ${input.unlock}`,
        why: "At least one of revenue, EBITDA, or cash is required to unlock a preliminary enterprise value range.",
        estimatedConfidenceGain: 40,
      },
    ],
    assumptions: [
      {
        id: "no-valuation",
        statement:
          "No preliminary enterprise value is shown until at least one of revenue, EBITDA, or cash is present.",
        source: "heuristic",
      },
    ],
    comparableBasis: null,
    potentialScenario: null,
    dataCompleteness: 0,
    missingInputs: [...MIN_VALUATION_INPUTS],
    snapshotId: input.snapshotId,
    generatedAt: input.generatedAt,
    provenance: {
      evidenceIds: input.evidenceIds,
      factKeys: [],
      note: "Provenance limited — no valuation inputs observed.",
    },
  };
}

export function estimateTransparentEnterpriseValue(input: {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  evidence: Evidence[];
}): EnterpriseValueEstimate {
  const generatedAt = new Date().toISOString();
  const valuationInput = valuationInputFromEvidence({
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    assessmentGoal: input.assessmentGoal,
    evidence: input.evidence,
  });

  // Negative EBITDA still counts as present — do not treat it as missing.
  const hasUnlock =
    (valuationInput.revenue != null && valuationInput.revenue > 0) ||
    valuationInput.ebitda != null ||
    valuationInput.cash != null;

  if (!hasUnlock) {
    const unlock =
      valuationInput.revenue == null || valuationInput.revenue <= 0
        ? "revenue"
        : valuationInput.ebitda == null
          ? "ebitda"
          : "cashBalance";
    return unavailableEstimate({
      snapshotId: input.snapshotId,
      generatedAt,
      unlock,
      evidenceIds: valuationInput.evidenceIds,
    });
  }

  const raw = estimateEnterpriseValue(valuationInput);
  const businessDiscounts = computeBusinessDiscounts(valuationInput, raw);
  const businessIds = new Set(businessDiscounts.map((d) => d.id));
  const evidenceDiscounts = computeEvidenceDiscounts(
    valuationInput,
    raw,
    businessIds,
  );

  const businessDiscountRange = sumRanges(
    businessDiscounts.map((d) => d.impactRange),
  );
  const evidenceDiscountRange = sumRanges(
    evidenceDiscounts.map((d) => d.impactRange),
  );

  // Apply business discount to current; evidence discount widens uncertainty
  // by further reducing the presented current range (never invents upside).
  const afterBusiness = applyDiscount(raw.currentRange, businessDiscountRange);
  const discountedCurrent = applyDiscount(afterBusiness, evidenceDiscountRange);

  // Potential remains the raw potential band (scenario-based upside), not fiction.
  const rawPotential = raw.potentialRange;

  // Confidence: raw confidence reduced by evidence discount presence (uncertainty),
  // not by business discounts (those change value, not confidence the same way).
  const evidencePenalty = Math.min(25, evidenceDiscounts.length * 6);
  const valuationConfidence = clampPct(raw.confidence - evidencePenalty);

  // Widen ranges as confidence falls — never fabricate precision.
  const current = widenRangeForConfidence(discountedCurrent, valuationConfidence);
  const potential = widenRangeForConfidence(rawPotential, valuationConfidence);
  const opportunity = valueGap(current, potential);

  const assumptions: ValueAssumption[] = [
    ...raw.assumptions,
    {
      id: "ev-transparent",
      statement:
        "Business discounts reflect observed weakness; evidence discounts reflect uncertainty. They are kept separate to avoid double-counting.",
      source: "heuristic",
    },
    {
      id: "ev-range-widen",
      statement:
        "Presented ranges widen as confidence decreases so the UI never implies false precision.",
      source: "heuristic",
    },
    {
      id: "ev-preliminary",
      statement:
        "This is a preliminary estimate based on the current evidence — not a formal appraisal.",
      source: "heuristic",
    },
  ];

  const factKeys = [
    valuationInput.revenue != null ? "revenue" : null,
    valuationInput.ebitda != null ? "ebitda" : null,
    valuationInput.cash != null ? "cashBalance" : null,
    valuationInput.growthRate != null ? "revenueGrowth" : null,
    valuationInput.grossMargin != null ? "grossMargin" : null,
    valuationInput.top3CustomerArrShare != null
      ? "top3CustomerArrShare"
      : null,
    valuationInput.cashRunwayMonths != null ? "cashRunwayMonths" : null,
    valuationInput.churnRate != null ? "churnRate" : null,
    valuationInput.nrr != null ? "netRevenueRetention" : null,
  ].filter((k): k is string => k != null);

  const discounts = [...businessDiscounts, ...evidenceDiscounts];
  const missingEvidencePriorities =
    rankMissingEvidencePriorities(evidenceDiscounts);

  return {
    available: true,
    unavailableReason: null,
    missingUnlockInput: null,
    currentEnterpriseValueRange: current,
    potentialEnterpriseValueRange: potential,
    enterpriseValueOpportunityRange: opportunity,
    valueGapRange: opportunity,
    valuationConfidence,
    valuationMethod: raw.method,
    businessDiscountRange,
    evidenceDiscountRange,
    businessDiscounts,
    evidenceDiscounts,
    discounts,
    missingEvidencePriorities,
    assumptions,
    comparableBasis: buildComparableBasis(raw, generatedAt),
    potentialScenario: buildPotentialScenario(potential, businessDiscounts),
    dataCompleteness: raw.dataCompleteness,
    missingInputs: raw.missingInputs,
    snapshotId: input.snapshotId,
    generatedAt,
    provenance: {
      evidenceIds: valuationInput.evidenceIds,
      factKeys,
      note:
        valuationInput.evidenceIds.length > 0
          ? "Valuation traces to structured facts on the listed evidence items."
          : "Provenance unavailable — no evidence IDs linked.",
    },
  };
}

/** Upload/evidence that raises confidence should not invent intrinsic value. */
export function confidenceGainDoesNotInflateIntrinsicValue(
  before: EnterpriseValueEstimate,
  after: EnterpriseValueEstimate,
): boolean {
  if (!before.available || !after.available) return true;
  if (!before.currentEnterpriseValueRange || !after.currentEnterpriseValueRange) {
    return true;
  }
  // If operating inputs unchanged, mid EV should not jump solely from confidence.
  // Callers pass estimates built from same financial facts for this check.
  const beforeMid = mid(before.currentEnterpriseValueRange);
  const afterMid = mid(after.currentEnterpriseValueRange);
  return Math.abs(afterMid - beforeMid) < beforeMid * 0.001 + 1;
}

export { emptyRange, mid as enterpriseValueMid };
