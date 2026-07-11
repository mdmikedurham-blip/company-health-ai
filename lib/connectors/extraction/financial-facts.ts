/**
 * Structured financial fact extraction from spreadsheet text (XLSX/CSV).
 *
 * Parses label→value rows only. Never infers missing metrics (e.g. runway
 * from cash/burn). Preserves worksheet, period, and actuals vs forecast.
 */

import type { ExtractedFacts } from "@/lib/domain";
import type { DocumentSection, ExtractedDocument } from "../extraction/types";

/** Canonical financial fact keys the scoring/analyzer layer understands. */
export const FINANCIAL_FACT_KEYS = [
  "revenue",
  "revenueGrowth",
  "grossMargin",
  "ebitda",
  "operatingIncome",
  "cashBalance",
  "burnRateMonthly",
  "cashRunwayMonths",
  "debt",
  "top3CustomerArrShare",
  "recurringRevenueShare",
  "netRevenueRetention",
  "churnRate",
] as const;

export type FinancialFactKey = (typeof FINANCIAL_FACT_KEYS)[number];

/** Minimum distinct financial facts required before Financial can be scored. */
export const MIN_FINANCIAL_FACTS_TO_SCORE = 2;

export type FinancialBasis = "actual" | "forecast" | "unknown";

export type FinancialMetricObservation = {
  key: FinancialFactKey;
  value: number;
  /** ISO-ish period label when detected, else null. */
  period: string | null;
  worksheet: string | null;
  basis: FinancialBasis;
  currency: string | null;
  /** true when value was a percent (stored as 0–1+ ratio). */
  isRatio: boolean;
  sourceLabel: string;
};

type LabelRule = {
  key: FinancialFactKey;
  /** Prefer more specific patterns first. */
  patterns: RegExp[];
  kind: "money" | "ratio" | "months" | "growth";
};

const LABEL_RULES: LabelRule[] = [
  {
    key: "cashRunwayMonths",
    patterns: [
      /\b(?:cash\s+)?runway(?:\s*\(months\))?$/i,
      /\bmonths?\s+of\s+(?:cash\s+)?runway$/i,
      /\brunway\s+months?$/i,
    ],
    kind: "months",
  },
  {
    key: "burnRateMonthly",
    patterns: [
      /\b(?:net\s+)?(?:monthly\s+)?burn(?:\s+rate)?$/i,
      /\bcash\s+burn$/i,
    ],
    kind: "money",
  },
  {
    key: "cashBalance",
    patterns: [
      /\bcash(?:\s+(?:&\s*)?equivalents)?(?:\s+balance)?$/i,
      /\bcash\s+on\s+hand$/i,
      /\bend(?:ing)?\s+cash$/i,
    ],
    kind: "money",
  },
  {
    key: "grossMargin",
    patterns: [/\bgross\s+margin(?:\s*%|\s+percent)?$/i, /\bgross\s+profit\s+margin$/i],
    kind: "ratio",
  },
  {
    key: "operatingIncome",
    patterns: [/\boperating\s+(?:income|profit)$/i, /\bebit$/i],
    kind: "money",
  },
  {
    key: "ebitda",
    patterns: [/\bebitda$/i, /\badjusted\s+ebitda$/i],
    kind: "money",
  },
  {
    key: "revenueGrowth",
    patterns: [
      /\brevenue\s+growth(?:\s*%|\s+yoy|\s+yo\s*y)?$/i,
      /\byoy\s+(?:revenue\s+)?growth$/i,
      /\bgrowth\s*%$/i,
    ],
    kind: "growth",
  },
  {
    key: "recurringRevenueShare",
    patterns: [
      /\b(?:%?\s*)?recurring\s+revenue(?:\s*%|\s+share)?$/i,
      /\brecurring\s+revenue\s+share$/i,
      /\bpercent\s+recurring$/i,
    ],
    kind: "ratio",
  },
  {
    key: "netRevenueRetention",
    patterns: [
      /\bnet\s+(?:revenue|dollar)\s+retention$/i,
      /\bnrr$/i,
      /\bndr$/i,
    ],
    kind: "ratio",
  },
  {
    key: "churnRate",
    patterns: [
      /\b(?:logo\s+|revenue\s+)?churn(?:\s+rate)?$/i,
      /\bmonthly\s+churn$/i,
    ],
    kind: "ratio",
  },
  {
    key: "top3CustomerArrShare",
    patterns: [
      /\btop\s*3\s+customer(?:s)?(?:\s+arr)?(?:\s+share|\s*%|\s+concentration)?$/i,
      /\bcustomer\s+concentration$/i,
      /\barr\s+concentration$/i,
    ],
    kind: "ratio",
  },
  {
    key: "debt",
    patterns: [/\b(?:total\s+)?debt$/i, /\blong[- ]term\s+debt$/i],
    kind: "money",
  },
  {
    key: "revenue",
    patterns: [
      /\b(?:total\s+)?(?:net\s+)?revenue$/i,
      /\barr$/i,
      /\bmrr$/i,
      /\bnet\s+sales$/i,
    ],
    kind: "money",
  },
];

const PERIOD_RE =
  /\b((?:FY|CY)?\s*20\d{2}(?:\s*[-/]\s*(?:Q[1-4]|H[12]|0?[1-9]|1[0-2]))?|Q[1-4]\s*20\d{2}|20\d{2}\s*Q[1-4]|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2})\b/i;

const FORECAST_RE = /\b(forecast|projection|projected|budget|plan|target|outlook)\b/i;
const ACTUAL_RE = /\b(actual|actuals|closed|audited|reported)\b/i;

export function countFinancialFacts(facts: ExtractedFacts): number {
  return FINANCIAL_FACT_KEYS.filter((k) => {
    const v = facts[k];
    return typeof v === "number" && Number.isFinite(v);
  }).length;
}

export function missingFinancialFactKeys(facts: ExtractedFacts): FinancialFactKey[] {
  return FINANCIAL_FACT_KEYS.filter((k) => {
    const v = facts[k];
    return !(typeof v === "number" && Number.isFinite(v));
  });
}

export function hasEnoughFinancialFacts(facts: ExtractedFacts): boolean {
  return countFinancialFacts(facts) >= MIN_FINANCIAL_FACTS_TO_SCORE;
}

function normalizeLabel(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBasis(context: string): FinancialBasis {
  if (FORECAST_RE.test(context)) return "forecast";
  if (ACTUAL_RE.test(context)) return "actual";
  return "unknown";
}

function detectPeriod(context: string): string | null {
  const m = PERIOD_RE.exec(context);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function parseNumericToken(raw: string): {
  value: number;
  currency: string | null;
  hadPercent: boolean;
} | null {
  let s = raw.replace(/\u00a0/g, " ").trim();
  if (!s || /^[-–—]$/.test(s)) return null;

  let currency: string | null = null;
  if (/^\$/.test(s) || /\bUSD\b/i.test(s)) currency = "USD";
  else if (/^€/.test(s) || /\bEUR\b/i.test(s)) currency = "EUR";
  else if (/^£/.test(s) || /\bGBP\b/i.test(s)) currency = "GBP";

  const hadPercent = /%/.test(s);
  s = s
    .replace(/[$,€£]/g, "")
    .replace(/\b(USD|EUR|GBP)\b/gi, "")
    .replace(/%/g, "")
    .replace(/,/g, "")
    .trim();

  // Accounting negatives: (1234)
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1).trim();
  }
  if (/^-/.test(s)) {
    neg = true;
    s = s.replace(/^-/, "").trim();
  }

  let multiplier = 1;
  if (/^[0-9.]+[kK]$/.test(s)) {
    multiplier = 1_000;
    s = s.slice(0, -1);
  } else if (/^[0-9.]+[mM]$/.test(s)) {
    multiplier = 1_000_000;
    s = s.slice(0, -1);
  } else if (/^[0-9.]+[bB]$/.test(s)) {
    multiplier = 1_000_000_000;
    s = s.slice(0, -1);
  }

  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(s)) return null;
  const n = Number(s) * multiplier;
  if (!Number.isFinite(n)) return null;
  return { value: neg ? -n : n, currency, hadPercent };
}

function matchLabel(label: string): LabelRule | null {
  const normalized = normalizeLabel(label);
  for (const rule of LABEL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) return rule;
    }
  }
  return null;
}

function coerceValue(
  rule: LabelRule,
  parsed: { value: number; currency: string | null; hadPercent: boolean },
): { value: number; isRatio: boolean; currency: string | null } {
  if (rule.kind === "months") {
    return { value: parsed.value, isRatio: false, currency: null };
  }
  if (rule.kind === "ratio" || rule.kind === "growth") {
    // 45 or 45% → 0.45; 1.08 or 108% → 1.08
    let v = parsed.value;
    if (parsed.hadPercent || v > 1.5) {
      v = v / 100;
    }
    return { value: v, isRatio: true, currency: null };
  }
  return {
    value: parsed.value,
    isRatio: false,
    currency: parsed.currency,
  };
}

function parseRowCells(
  cells: string[],
  worksheet: string | null,
  sheetContext: string,
): FinancialMetricObservation[] {
  if (cells.length < 2) return [];
  const out: FinancialMetricObservation[] = [];

  // Prefer first non-empty cell as label, remaining as candidate values.
  const nonEmpty = cells.map((c) => c.trim()).filter((c) => c.length > 0);
  if (nonEmpty.length < 2) return [];

  const label = nonEmpty[0]!;
  const rule = matchLabel(label);
  if (!rule) return [];

  const context = `${sheetContext} ${worksheet ?? ""} ${label} ${nonEmpty.join(" ")}`;
  const basis = detectBasis(context);
  const period = detectPeriod(context);

  for (let i = 1; i < nonEmpty.length; i++) {
    const token = nonEmpty[i]!;
    // Skip period-looking tokens that aren't numeric values
    if (PERIOD_RE.test(token) && !/[0-9]+(?:\.[0-9]+)?%?/.test(token.replace(/,/g, ""))) {
      continue;
    }
    const parsed = parseNumericToken(token);
    if (!parsed) continue;
    const coerced = coerceValue(rule, parsed);
    out.push({
      key: rule.key,
      value: coerced.value,
      period,
      worksheet,
      basis,
      currency: coerced.currency,
      isRatio: coerced.isRatio,
      sourceLabel: normalizeLabel(label),
    });
    break; // first numeric value wins for the row (no inference across columns)
  }

  return out;
}

function parseSection(section: DocumentSection): FinancialMetricObservation[] {
  const worksheet =
    (typeof section.metadata?.sheet === "string"
      ? section.metadata.sheet
      : section.title) ?? null;
  const sheetContext = `${worksheet ?? ""} ${section.title ?? ""}`;
  const rows = section.text.split("\n");
  const observations: FinancialMetricObservation[] = [];
  for (const row of rows) {
    if (!row.trim() || row.trim() === "(empty sheet)") continue;
    const cells = row.split("\t");
    observations.push(...parseRowCells(cells, worksheet, sheetContext));
  }
  return observations;
}

/**
 * Prefer actuals over forecast when both exist for the same key.
 * Do not invent values — only choose among observed cells.
 */
export function selectCanonicalObservations(
  observations: FinancialMetricObservation[],
): FinancialMetricObservation[] {
  const byKey = new Map<FinancialFactKey, FinancialMetricObservation[]>();
  for (const obs of observations) {
    const list = byKey.get(obs.key) ?? [];
    list.push(obs);
    byKey.set(obs.key, list);
  }

  const selected: FinancialMetricObservation[] = [];
  for (const [, list] of byKey) {
    const actuals = list.filter((o) => o.basis === "actual");
    const unknowns = list.filter((o) => o.basis === "unknown");
    const forecasts = list.filter((o) => o.basis === "forecast");
    const pick = actuals[0] ?? unknowns[0] ?? forecasts[0];
    if (pick) selected.push(pick);
  }
  return selected;
}

export function extractFinancialObservations(
  extracted: ExtractedDocument,
): FinancialMetricObservation[] {
  const format = String(extracted.metadata.format ?? "").toUpperCase();
  const isSpreadsheet =
    format === "XLSX" ||
    format === "CSV" ||
    format === "GOOGLE_SHEETS" ||
    extracted.sections.some((s) => s.text.includes("\t"));

  if (!isSpreadsheet && extracted.sections.length === 0) {
    // Fall back to whole-text TSV parsing for CSV-like blobs
    return selectCanonicalObservations(
      parseSection({
        id: "sheet-1",
        title: "Sheet",
        text: extracted.text,
        order: 1,
      }),
    );
  }

  const observations: FinancialMetricObservation[] = [];
  if (extracted.sections.length > 0) {
    for (const section of extracted.sections) {
      observations.push(...parseSection(section));
    }
  } else {
    observations.push(
      ...parseSection({
        id: "sheet-1",
        title: "Sheet",
        text: extracted.text,
        order: 1,
      }),
    );
  }
  return selectCanonicalObservations(observations);
}

/**
 * Merge spreadsheet metrics into extractedFacts.
 * Existing typed keys from prose regex are kept unless spreadsheet provides the same key.
 */
export function mergeFinancialFactsInto(
  facts: ExtractedFacts,
  extracted: ExtractedDocument,
): {
  facts: ExtractedFacts;
  observations: FinancialMetricObservation[];
  missingRequired: FinancialFactKey[];
} {
  const observations = extractFinancialObservations(extracted);
  const next: ExtractedFacts = { ...facts };

  for (const obs of observations) {
    next[obs.key] = obs.value;
    next[`${obs.key}Worksheet`] = obs.worksheet;
    next[`${obs.key}Period`] = obs.period;
    next[`${obs.key}Basis`] = obs.basis;
    if (obs.currency) next[`${obs.key}Currency`] = obs.currency;
    next[`${obs.key}SourceLabel`] = obs.sourceLabel;
  }

  if (observations.length > 0) {
    next.financialMetricKeys = observations.map((o) => o.key);
    next.financialMetricCount = observations.length;
    next.financialExtractionSource = String(extracted.metadata.format ?? "spreadsheet");
  }

  const missingRequired = hasEnoughFinancialFacts(next)
    ? []
    : missingFinancialFactKeys(next).slice(0, 8);

  if (observations.length > 0 || countFinancialFacts(next) > 0) {
    next.missingFinancialFields = missingRequired;
    next.financialFactsComplete = hasEnoughFinancialFacts(next);
  }

  return { facts: next, observations, missingRequired };
}
