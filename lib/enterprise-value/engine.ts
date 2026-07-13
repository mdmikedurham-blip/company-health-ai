/**
 * Transparent Enterprise Value Engine — Phase 11.
 * Wraps Phase 10 valuation plugins with business vs evidence discounts.
 * Demo safety: no valuation when required financial inputs are absent.
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  ComparableBasis,
  EnterpriseValueEstimate,
  PotentialValueScenario,
  ValuationDiscount,
} from "@/lib/domain/enterprise-value";
import type {
  MoneyRange,
  ValuationEstimate,
  ValuationEstimateInput,
  ValueAssumption,
} from "@/lib/domain/value-navigator";
import {
  estimateEnterpriseValue,
  valuationInputFromEvidence,
  moneyRange,
  mid,
  valueGap,
  clampPct,
} from "@/lib/value-navigator";

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

  if (
    input.top3CustomerArrShare != null &&
    input.top3CustomerArrShare >= 0.35
  ) {
    const pct = (input.top3CustomerArrShare * 100).toFixed(0);
    discounts.push({
      id: "biz-concentration",
      kind: "business",
      title: "Customer concentration",
      impactRange: moneyRange(baseMid * 0.05, baseMid * 0.15),
      rationale: `Top-3 concentration is ${pct}%. Buyers and investors typically apply a risk discount when revenue depends on a few accounts.`,
      confidence: 70,
      supportingEvidenceIds: input.evidenceIds.slice(0, 3),
      assumptions: [
        {
          id: "biz-conc-band",
          statement: "Concentration discount uses a 5–15% of mid-EV heuristic band.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt:
        "Diversify ARR so top-3 customers are ≤20% of revenue.",
    });
  }

  if (input.growthRate != null && input.growthRate < 0.1) {
    discounts.push({
      id: "biz-low-growth",
      kind: "business",
      title: "Low revenue growth",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Observed growth ${(input.growthRate * 100).toFixed(0)}% is below a typical growth-stage band, which compresses multiples.`,
      confidence: 65,
      supportingEvidenceIds: input.evidenceIds.slice(0, 3),
      assumptions: [
        {
          id: "biz-growth",
          statement: "Low-growth discount applies when YoY growth is below 10%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Sustainably raise revenue growth toward ≥25% YoY.",
    });
  }

  if (input.cashRunwayMonths != null && input.cashRunwayMonths < 12) {
    discounts.push({
      id: "biz-runway",
      kind: "business",
      title: "Short cash runway",
      impactRange: moneyRange(baseMid * 0.06, baseMid * 0.18),
      rationale: `Runway is ${input.cashRunwayMonths} months. Short runway forces distressed decisions and reduces negotiation leverage.`,
      confidence: 75,
      supportingEvidenceIds: input.evidenceIds.slice(0, 3),
      assumptions: [
        {
          id: "biz-runway",
          statement: "Runway discount applies when cash runway is under 12 months.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Extend runway to ≥12 months via burn reduction or capital.",
    });
  }

  if (input.churnRate != null && input.churnRate >= 0.08) {
    discounts.push({
      id: "biz-churn",
      kind: "business",
      title: "Elevated churn",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Churn at ${(input.churnRate * 100).toFixed(0)}% weakens recurring cash-flow quality.`,
      confidence: 60,
      supportingEvidenceIds: input.evidenceIds.slice(0, 3),
      assumptions: [
        {
          id: "biz-churn",
          statement: "Churn discount applies when churn ≥8%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Reduce churn toward ≤4% with retention programs.",
    });
  }

  if (input.grossMargin != null && input.grossMargin < 0.6) {
    discounts.push({
      id: "biz-margin",
      kind: "business",
      title: "Gross margin below software quality band",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.1),
      rationale: `Gross margin ${(input.grossMargin * 100).toFixed(0)}% is below a typical software quality band.`,
      confidence: 55,
      supportingEvidenceIds: input.evidenceIds.slice(0, 3),
      assumptions: [
        {
          id: "biz-gm",
          statement: "Margin discount applies when gross margin is below 60%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Improve gross margin toward ≥70%.",
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
    discounts.push({
      id: "ev-missing-concentration",
      kind: "evidence",
      title: "No customer-level revenue data",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.1),
      rationale:
        "Without a customer revenue export, concentration risk cannot be measured — the estimate is discounted for uncertainty.",
      confidence: 50,
      supportingEvidenceIds: [],
      assumptions: [
        {
          id: "ev-conc",
          statement: "Missing concentration fact widens uncertainty discount.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Share a customer revenue / ARR-by-account export.",
    });
  }

  if (input.churnRate == null && input.nrr == null && !businessIds.has("biz-churn")) {
    discounts.push({
      id: "ev-missing-retention",
      kind: "evidence",
      title: "No churn or cohort retention data",
      impactRange: moneyRange(baseMid * 0.03, baseMid * 0.09),
      rationale:
        "Retention quality is unknown. The estimate is discounted until churn or NRR evidence arrives.",
      confidence: 45,
      supportingEvidenceIds: [],
      assumptions: [
        {
          id: "ev-ret",
          statement: "Missing churn/NRR applies an evidence discount only.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Share a churn report or NRR cohort workbook.",
    });
  }

  if (input.growthRate == null && !businessIds.has("biz-low-growth")) {
    discounts.push({
      id: "ev-missing-growth",
      kind: "evidence",
      title: "Incomplete growth history",
      impactRange: moneyRange(baseMid * 0.02, baseMid * 0.08),
      rationale:
        "Revenue growth is not observed in the current snapshot — multiple selection is less certain.",
      confidence: 40,
      supportingEvidenceIds: [],
      assumptions: [
        {
          id: "ev-growth",
          statement: "Missing growth fact applies evidence discount, not a business weakness claim.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Share ARR trend or YoY growth in a financial workbook.",
    });
  }

  if (input.cashRunwayMonths == null && !businessIds.has("biz-runway")) {
    discounts.push({
      id: "ev-missing-runway",
      kind: "evidence",
      title: "No cash runway evidence",
      impactRange: moneyRange(baseMid * 0.02, baseMid * 0.07),
      rationale:
        "Runway is unknown. Liquidity risk cannot be ruled out from the current evidence.",
      confidence: 40,
      supportingEvidenceIds: [],
      assumptions: [
        {
          id: "ev-runway",
          statement: "Missing runway is an evidence gap, not an asserted short-runway finding.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt: "Share a cash / burn workbook with runway.",
    });
  }

  if (raw.dataCompleteness < 50) {
    discounts.push({
      id: "ev-incomplete",
      kind: "evidence",
      title: "Incomplete financial evidence",
      impactRange: moneyRange(baseMid * 0.04, baseMid * 0.12),
      rationale: `Data completeness is ${raw.dataCompleteness}%. The estimate remains preliminary until more financial facts are present.`,
      confidence: 55,
      supportingEvidenceIds: input.evidenceIds.slice(0, 2),
      assumptions: [
        {
          id: "ev-complete",
          statement: "Broad incompleteness discount when data completeness < 50%.",
          source: "heuristic",
        },
      ],
      whatWouldReduceIt:
        "Add revenue, margin, growth, retention, and cash facts from one current workbook.",
    });
  }

  return discounts;
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
    requiredImprovements: business.map((d) => d.whatWouldReduceIt).slice(0, 5),
    executionProbability: clampPct(55 - business.length * 5),
    dependencies: ["Leadership capacity", "Capital availability", "Evidence quality"],
    risks: business.map((d) => d.title).slice(0, 4),
    valueRange: adjustedPotential,
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

  const hasUnlock =
    (valuationInput.revenue != null && valuationInput.revenue > 0) ||
    (valuationInput.ebitda != null && valuationInput.ebitda > 0) ||
    valuationInput.cash != null;

  if (!hasUnlock) {
    const unlock =
      valuationInput.revenue == null
        ? "revenue"
        : valuationInput.ebitda == null
          ? "ebitda"
          : "cashBalance";
    return {
      available: false,
      unavailableReason:
        "Preliminary valuation unavailable — required financial inputs are not present in the current snapshot.",
      missingUnlockInput: unlock,
      currentEnterpriseValueRange: null,
      potentialEnterpriseValueRange: null,
      valueGapRange: null,
      valuationConfidence: 0,
      valuationMethod: "unavailable",
      businessDiscountRange: null,
      evidenceDiscountRange: null,
      businessDiscounts: [],
      evidenceDiscounts: [],
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
      generatedAt,
      provenance: {
        evidenceIds: valuationInput.evidenceIds,
        factKeys: [],
        note: "Provenance limited — no valuation inputs observed.",
      },
    };
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
  const current = applyDiscount(afterBusiness, evidenceDiscountRange);

  // Potential remains the raw potential band (scenario-based upside), not fiction.
  const potential = raw.potentialRange;
  const gap = valueGap(current, potential);

  const assumptions: ValueAssumption[] = [
    ...raw.assumptions,
    {
      id: "ev-transparent",
      statement:
        "Business discounts reflect observed weakness; evidence discounts reflect uncertainty. They are kept separate to avoid double-counting.",
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

  // Confidence: raw confidence reduced by evidence discount presence (uncertainty),
  // not by business discounts (those change value, not confidence the same way).
  const evidencePenalty = Math.min(25, evidenceDiscounts.length * 6);
  const valuationConfidence = clampPct(raw.confidence - evidencePenalty);

  return {
    available: true,
    unavailableReason: null,
    missingUnlockInput: null,
    currentEnterpriseValueRange: current,
    potentialEnterpriseValueRange: potential,
    valueGapRange: gap,
    valuationConfidence,
    valuationMethod: raw.method,
    businessDiscountRange,
    evidenceDiscountRange,
    businessDiscounts,
    evidenceDiscounts,
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
