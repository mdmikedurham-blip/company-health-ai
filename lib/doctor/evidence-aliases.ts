/**
 * Bridge playbook/investigation evidence-type vocabulary with persisted
 * workbook facts (camelCase keys) and classifier source types.
 */

import type { CompanyHealthSnapshot, Evidence } from "@/lib/domain";
import { FINANCIAL_FACT_KEYS } from "@/lib/connectors/extraction/financial-facts";

/** Catalog / diligence snake_case types → fact keys that satisfy them. */
export const EVIDENCE_TYPE_FACT_KEYS: Record<string, readonly string[]> = {
  cash_runway: ["cashRunwayMonths", "burnRateMonthly", "cashBalance"],
  financial_statements: [
    "revenue",
    "revenueGrowth",
    "grossMargin",
    "ebitda",
    "operatingIncome",
    "cashBalance",
    "burnRateMonthly",
    "cashRunwayMonths",
    "debt",
  ],
  arr_snapshot: ["top3CustomerArrShare", "recurringRevenueShare"],
  revenue_growth: ["revenueGrowth", "revenue"],
  board_minutes: [],
  security_policies: [],
  soc2: [],
  incident_response: [],
  ip_assignments: [],
  customer_contracts: [],
  org_chart: [],
};

/** Source / classifier types that can satisfy a catalog type when facts exist. */
export const EVIDENCE_TYPE_SOURCE_TYPES: Record<string, readonly string[]> = {
  cash_runway: ["cash_runway", "financial"],
  financial_statements: ["financial_statements", "financial"],
  arr_snapshot: ["arr_snapshot", "revenue", "financial"],
  revenue_growth: ["revenue_growth", "revenue", "financial"],
};

export function collectPresentEvidenceTokens(
  snapshot: Pick<CompanyHealthSnapshot, "evidence">,
): Set<string> {
  const tokens = new Set<string>();
  for (const e of snapshot.evidence) {
    tokens.add(e.sourceType);
    const meta = e.metadata?.evidenceType;
    if (typeof meta === "string") tokens.add(meta);
    for (const key of Object.keys(e.extractedFacts ?? {})) {
      tokens.add(key);
    }
  }
  return tokens;
}

function evidenceHasFactKeys(
  evidence: Evidence[],
  keys: readonly string[],
): boolean {
  if (keys.length === 0) return false;
  for (const e of evidence) {
    const facts = e.extractedFacts ?? {};
    for (const key of keys) {
      const v = facts[key];
      if (v !== null && v !== undefined && v !== "") return true;
    }
  }
  return false;
}

/**
 * True when at least one requested evidence type is already present via
 * source type, metadata type, or structured financial fact keys.
 */
export function evidenceRequestSatisfied(
  evidenceTypes: string[],
  present: Set<string>,
  evidence: Evidence[],
): boolean {
  if (evidenceTypes.length === 0) return false;

  return evidenceTypes.some((type) => {
    if (present.has(type)) return true;

    const factKeys = EVIDENCE_TYPE_FACT_KEYS[type] ?? [];
    if (factKeys.some((k) => present.has(k))) return true;
    if (evidenceHasFactKeys(evidence, factKeys)) return true;

    // "financial" source alone satisfies financial_statements when any
    // canonical financial fact exists on that workbook.
    const sources = EVIDENCE_TYPE_SOURCE_TYPES[type] ?? [];
    if (sources.some((s) => present.has(s))) {
      if (type === "financial_statements" || type === "cash_runway") {
        return evidenceHasFactKeys(
          evidence,
          factKeys.length > 0 ? factKeys : FINANCIAL_FACT_KEYS,
        );
      }
      if (factKeys.length === 0) return true;
      return evidenceHasFactKeys(evidence, factKeys);
    }

    return false;
  });
}

/** Whether any canonical financial fact is present in the snapshot. */
export function snapshotHasFinancialFacts(
  snapshot: Pick<CompanyHealthSnapshot, "evidence">,
): boolean {
  return evidenceHasFactKeys(snapshot.evidence, FINANCIAL_FACT_KEYS);
}
