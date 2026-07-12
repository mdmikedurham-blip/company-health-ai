/**
 * Income-approach heuristic (simplified earnings capitalization).
 * Uses EBITDA × capitalization band when EBITDA is available.
 */

import type {
  ValuationEstimate,
  ValuationEstimateInput,
  ValuationProvider,
} from "@/lib/domain/value-navigator";
import { clampPct, moneyRange } from "../money";

const CAP_MULTIPLE = { low: 8, high: 14 };

export const incomeHeuristicProvider: ValuationProvider = {
  id: "income-heuristic",
  label: "Income approach (EBITDA heuristic)",
  estimate(input: ValuationEstimateInput): ValuationEstimate {
    const missing: string[] = [];
    if (input.ebitda == null) missing.push("ebitda");
    if (input.revenue == null) missing.push("revenue");

    const assumptions = [
      {
        id: "inc-cap",
        statement: `EBITDA capitalization multiples assumed in the ${CAP_MULTIPLE.low}x–${CAP_MULTIPLE.high}x band (rule-based heuristic).`,
        source: "heuristic" as const,
      },
      {
        id: "inc-range",
        statement:
          "Income approach results are ranges only; no DCF terminal-value precision is claimed.",
        source: "heuristic" as const,
      },
    ];

    if (input.ebitda == null || input.ebitda <= 0) {
      // Fall back: thin placeholder from revenue if present, else empty.
      if (input.revenue != null && input.revenue > 0) {
        assumptions.push({
          id: "inc-fallback",
          statement:
            "EBITDA missing — income approach cannot run; returning incomplete estimate.",
          source: "heuristic",
        });
      }
      return {
        method: "income-heuristic",
        currentRange: moneyRange(0, 0),
        potentialRange: moneyRange(0, 0),
        confidence: 8,
        dataCompleteness: input.ebitda != null ? 20 : 0,
        assumptions,
        missingInputs: missing,
      };
    }

    const ebitda = input.ebitda;
    const currentRange = moneyRange(
      ebitda * CAP_MULTIPLE.low,
      ebitda * CAP_MULTIPLE.high,
    );
    // Potential: modest EBITDA expansion (10–25%) at same band.
    const potentialRange = moneyRange(
      ebitda * 1.1 * CAP_MULTIPLE.low,
      ebitda * 1.25 * CAP_MULTIPLE.high,
    );
    assumptions.push({
      id: "inc-potential",
      statement:
        "Potential assumes 10–25% EBITDA improvement while holding the same capitalization band.",
      source: "heuristic",
    });

    const known = [input.ebitda, input.revenue, input.grossMargin, input.cash].filter(
      (v) => v != null,
    ).length;
    const dataCompleteness = clampPct((known / 4) * 100);
    const confidence = clampPct(20 + dataCompleteness * 0.4);

    return {
      method: "income-heuristic",
      currentRange,
      potentialRange,
      confidence,
      dataCompleteness,
      assumptions,
      missingInputs: missing,
    };
  },
};
