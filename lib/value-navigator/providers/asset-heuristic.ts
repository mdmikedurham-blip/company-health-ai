/**
 * Asset-approach heuristic — cash/net assets floor (conservative).
 */

import type {
  ValuationEstimate,
  ValuationEstimateInput,
  ValuationProvider,
} from "@/lib/domain/value-navigator";
import { clampPct, moneyRange } from "../money";

export const assetHeuristicProvider: ValuationProvider = {
  id: "asset-heuristic",
  label: "Asset approach (cash floor)",
  estimate(input: ValuationEstimateInput): ValuationEstimate {
    const missing: string[] = [];
    if (input.cash == null) missing.push("cashBalance");

    const assumptions = [
      {
        id: "asset-floor",
        statement:
          "Asset approach uses observed cash as a conservative floor; intangibles and goodwill are not appraised here.",
        source: "heuristic" as const,
      },
    ];

    if (input.cash == null) {
      return {
        method: "asset-heuristic",
        currentRange: moneyRange(0, 0),
        potentialRange: moneyRange(0, 0),
        confidence: 5,
        dataCompleteness: 0,
        assumptions,
        missingInputs: missing,
      };
    }

    const cash = Math.max(0, input.cash);
    // Floor band: cash to cash + small operating buffer proxy.
    const currentRange = moneyRange(cash * 0.9, cash * 1.1);
    const potentialRange = moneyRange(cash * 0.9, cash * 1.5);
    assumptions.push({
      id: "asset-potential",
      statement:
        "Potential under asset approach only reflects preserving/growing cash — not full enterprise upside.",
      source: "heuristic",
    });

    const dataCompleteness = clampPct(input.cash != null ? 40 : 0);
    const confidence = clampPct(15 + dataCompleteness * 0.3);

    return {
      method: "asset-heuristic",
      currentRange,
      potentialRange,
      confidence,
      dataCompleteness,
      assumptions,
      missingInputs: missing,
    };
  },
};
