/**
 * Build valuation input from evidence facts (no full snapshot required).
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { ValuationEstimateInput } from "@/lib/domain/value-navigator";
import {
  FINANCIAL_FACT_KEYS,
  type FinancialFactKey,
} from "@/lib/connectors/extraction/financial-facts";
import { asRatio } from "./money";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const MONEY_KEYS = new Set<FinancialFactKey>([
  "revenue",
  "ebitda",
  "operatingIncome",
  "cashBalance",
  "burnRateMonthly",
  "debt",
]);

export function collectFinancialFactMap(
  evidence: Evidence[],
): Map<FinancialFactKey, number> {
  const map = new Map<FinancialFactKey, number>();
  // Newest first so non-money keys take the latest observation.
  const ordered = [...evidence].sort((a, b) =>
    (b.collectedAt || "").localeCompare(a.collectedAt || ""),
  );
  for (const e of ordered) {
    const facts = e.extractedFacts ?? {};
    for (const key of FINANCIAL_FACT_KEYS) {
      const value = asNumber(facts[key]);
      if (value === null) continue;
      const existing = map.get(key);
      if (existing === undefined) {
        map.set(key, value);
        continue;
      }
      // Across documents, prefer larger |money| (e.g. ARR over Year-1 stub).
      if (MONEY_KEYS.has(key) && Math.abs(value) > Math.abs(existing)) {
        map.set(key, value);
      }
    }
  }
  return map;
}

export function valuationInputFromEvidence(input: {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  evidence: Evidence[];
}): ValuationEstimateInput {
  const facts = collectFinancialFactMap(input.evidence);
  const get = (key: FinancialFactKey): number | null => {
    const v = facts.get(key);
    return v != null && Number.isFinite(v) ? v : null;
  };

  return {
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    assessmentGoal: input.assessmentGoal,
    revenue: get("revenue"),
    ebitda: get("ebitda"),
    cash: get("cashBalance"),
    growthRate: asRatio(get("revenueGrowth")),
    grossMargin: asRatio(get("grossMargin")),
    churnRate: asRatio(get("churnRate")),
    nrr: asRatio(get("netRevenueRetention")),
    top3CustomerArrShare: asRatio(get("top3CustomerArrShare")),
    recurringRevenueShare: asRatio(get("recurringRevenueShare")),
    cashRunwayMonths: get("cashRunwayMonths"),
    evidenceIds: input.evidence.map((e) => e.id),
  };
}
