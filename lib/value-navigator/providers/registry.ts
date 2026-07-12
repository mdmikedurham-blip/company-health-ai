/**
 * Pluggable valuation registry.
 * Primary: market multiples when revenue exists; else income; else asset; else empty.
 * ML provider reserved for future integration.
 */

import type {
  ValuationEstimate,
  ValuationEstimateInput,
  ValuationMethodId,
  ValuationProvider,
} from "@/lib/domain/value-navigator";
import { moneyRange } from "../money";
import { assetHeuristicProvider } from "./asset-heuristic";
import { incomeHeuristicProvider } from "./income-heuristic";
import { marketMultiplesProvider } from "./market-multiples";

export const VALUATION_PROVIDERS: ValuationProvider[] = [
  marketMultiplesProvider,
  incomeHeuristicProvider,
  assetHeuristicProvider,
];

export function getValuationProvider(
  id: ValuationMethodId,
): ValuationProvider | null {
  return VALUATION_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Reserved stub — never fabricates values. */
export const mlFutureProvider: ValuationProvider = {
  id: "ml-future",
  label: "ML model (future)",
  estimate(): ValuationEstimate {
    return {
      method: "ml-future",
      currentRange: moneyRange(0, 0),
      potentialRange: moneyRange(0, 0),
      confidence: 0,
      dataCompleteness: 0,
      assumptions: [
        {
          id: "ml-not-ready",
          statement:
            "ML valuation plugin is reserved; it does not emit estimates until trained and approved.",
          source: "heuristic",
        },
      ],
      missingInputs: ["ml-model"],
    };
  },
};

/**
 * Select and run the best available plugin for the input.
 * Prefer market multiples with revenue; fall back to income, then asset.
 */
export function estimateEnterpriseValue(
  input: ValuationEstimateInput,
  preferredMethod?: ValuationMethodId,
): ValuationEstimate {
  if (preferredMethod && preferredMethod !== "ml-future") {
    const p = getValuationProvider(preferredMethod);
    if (p) return p.estimate(input);
  }

  if (input.revenue != null && input.revenue > 0) {
    return marketMultiplesProvider.estimate(input);
  }
  if (input.ebitda != null && input.ebitda > 0) {
    return incomeHeuristicProvider.estimate(input);
  }
  if (input.cash != null) {
    return assetHeuristicProvider.estimate(input);
  }

  return {
    method: "rule-based",
    currentRange: moneyRange(0, 0),
    potentialRange: moneyRange(0, 0),
    confidence: 0,
    dataCompleteness: 0,
    assumptions: [
      {
        id: "no-inputs",
        statement:
          "No revenue, EBITDA, or cash facts available — cannot estimate enterprise value.",
        source: "heuristic",
      },
    ],
    missingInputs: ["revenue", "ebitda", "cashBalance"],
  };
}
