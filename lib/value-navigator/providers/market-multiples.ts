/**
 * Market multiples valuation plugin.
 * Uses industry revenue-multiple bands — documented assumptions, never point estimates.
 */

import type {
  ValuationEstimate,
  ValuationEstimateInput,
  ValuationProvider,
  ValueAssumption,
} from "@/lib/domain/value-navigator";
import { clampPct, moneyRange } from "../money";

/** Assumed SaaS revenue multiple band (documented heuristic, not market quote). */
const BASE_MULTIPLE = { low: 4, high: 8 };
const GROWTH_BOOST = { low: 1, high: 3 };
const MARGIN_BOOST = { low: 0.5, high: 1.5 };
const CONCENTRATION_HAIRCUT = { low: 0.85, high: 0.95 };

export const marketMultiplesProvider: ValuationProvider = {
  id: "market-multiples",
  label: "Market multiples (revenue)",
  estimate(input: ValuationEstimateInput): ValuationEstimate {
    const missing: string[] = [];
    if (input.revenue == null) missing.push("revenue");
    if (input.growthRate == null) missing.push("revenueGrowth");
    if (input.grossMargin == null) missing.push("grossMargin");

    const assumptions: ValueAssumption[] = [
      {
        id: "mm-base-multiple",
        statement: `Private SaaS revenue multiples assumed in the ${BASE_MULTIPLE.low}x–${BASE_MULTIPLE.high}x band (heuristic, not a live market quote).`,
        source: "heuristic",
      },
      {
        id: "mm-range-only",
        statement:
          "Enterprise value is expressed as a range; midpoints are for ranking only and are not precision claims.",
        source: "heuristic",
      },
    ];

    if (input.revenue == null || input.revenue <= 0) {
      return {
        method: "market-multiples",
        currentRange: moneyRange(0, 0),
        potentialRange: moneyRange(0, 0),
        confidence: 5,
        dataCompleteness: 0,
        assumptions,
        missingInputs: missing.length ? missing : ["revenue"],
      };
    }

    const revenue = input.revenue;
    let multLow = BASE_MULTIPLE.low;
    let multHigh = BASE_MULTIPLE.high;

    if (input.growthRate != null && input.growthRate >= 0.3) {
      multLow += GROWTH_BOOST.low;
      multHigh += GROWTH_BOOST.high;
      assumptions.push({
        id: "mm-growth",
        statement: `Observed growth ${(input.growthRate * 100).toFixed(0)}% supports a higher multiple band.`,
        source: "evidence",
      });
    }

    if (input.grossMargin != null && input.grossMargin >= 0.7) {
      multLow += MARGIN_BOOST.low;
      multHigh += MARGIN_BOOST.high;
      assumptions.push({
        id: "mm-margin",
        statement: `Gross margin ${(input.grossMargin * 100).toFixed(0)}% supports quality premium within the band.`,
        source: "evidence",
      });
    }

    if (input.top3CustomerArrShare != null && input.top3CustomerArrShare >= 0.35) {
      multLow *= CONCENTRATION_HAIRCUT.low;
      multHigh *= CONCENTRATION_HAIRCUT.high;
      assumptions.push({
        id: "mm-concentration",
        statement: `Top-3 concentration ${(input.top3CustomerArrShare * 100).toFixed(0)}% applies a multiple haircut.`,
        source: "evidence",
      });
    }

    const currentRange = moneyRange(revenue * multLow, revenue * multHigh);

    // Potential: improve growth/margin/concentration toward healthier comps.
    const potLow = BASE_MULTIPLE.low + GROWTH_BOOST.low + MARGIN_BOOST.low;
    const potHigh = BASE_MULTIPLE.high + GROWTH_BOOST.high + MARGIN_BOOST.high;
    assumptions.push({
      id: "mm-potential",
      statement:
        "Potential assumes improved growth, margin, and concentration toward healthier SaaS comps — not a guaranteed outcome.",
      source: "heuristic",
    });

    const potentialRange = moneyRange(revenue * potLow, revenue * potHigh);

    const known = [
      input.revenue,
      input.growthRate,
      input.grossMargin,
      input.top3CustomerArrShare,
      input.recurringRevenueShare,
      input.nrr,
    ].filter((v) => v != null).length;
    const dataCompleteness = clampPct((known / 6) * 100);
    const confidence = clampPct(
      25 + dataCompleteness * 0.45 + (input.evidenceIds.length > 0 ? 10 : 0),
    );

    return {
      method: "market-multiples",
      currentRange,
      potentialRange,
      confidence,
      dataCompleteness,
      assumptions,
      missingInputs: missing,
    };
  },
};
