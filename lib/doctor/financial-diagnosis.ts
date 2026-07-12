/**
 * Financial diagnosis from persisted workbook facts.
 * Doctor can reason from facts without requiring findings/risks.
 */

import type { CompanyHealthSnapshot, Evidence } from "@/lib/domain";
import {
  FINANCIAL_FACT_KEYS,
  type FinancialFactKey,
} from "@/lib/connectors/extraction/financial-facts";

export type DoctorStructuredFact = {
  key: FinancialFactKey;
  value: number;
  evidenceId: string;
  evidenceTitle: string;
  sourceSystem: string;
  worksheet: string | null;
  period: string | null;
  basis: string | null;
};

export type DoctorFinancialIssue = {
  id: string;
  title: string;
  summary: string;
  severity: "high" | "medium" | "low";
  confidence: number;
  factKeys: FinancialFactKey[];
  evidenceIds: string[];
  nextAction: string;
};

export type DoctorFinancialDiagnosis = {
  facts: DoctorStructuredFact[];
  issues: DoctorFinancialIssue[];
  /** Highest-confidence material issue, if any. */
  primaryIssue: DoctorFinancialIssue | null;
  /** True when facts exist but no high-confidence critical issue. */
  noMaterialIssue: boolean;
  unknowns: string[];
  snapshotId: string | null;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function metaString(
  facts: Evidence["extractedFacts"],
  key: string,
): string | null {
  const v = facts[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Collect canonical financial facts from snapshot evidence (one value per key;
 * prefer most recently collected evidence).
 */
export function collectStructuredFinancialFacts(
  snapshot: Pick<CompanyHealthSnapshot, "evidence">,
): DoctorStructuredFact[] {
  const byKey = new Map<FinancialFactKey, DoctorStructuredFact>();

  const ordered = [...snapshot.evidence].sort((a, b) =>
    (b.collectedAt || "").localeCompare(a.collectedAt || ""),
  );

  for (const e of ordered) {
    const facts = e.extractedFacts ?? {};
    for (const key of FINANCIAL_FACT_KEYS) {
      if (byKey.has(key)) continue;
      const value = asNumber(facts[key]);
      if (value === null) continue;
      byKey.set(key, {
        key,
        value,
        evidenceId: e.id,
        evidenceTitle: e.title,
        sourceSystem: e.sourceSystem,
        worksheet: metaString(facts, `${key}Worksheet`),
        period: metaString(facts, `${key}Period`),
        basis: metaString(facts, `${key}Basis`),
      });
    }
  }

  return [...byKey.values()];
}

function formatMetric(fact: DoctorStructuredFact): string {
  const { key, value } = fact;
  if (
    key === "grossMargin" ||
    key === "revenueGrowth" ||
    key === "recurringRevenueShare" ||
    key === "top3CustomerArrShare" ||
    key === "churnRate" ||
    key === "netRevenueRetention"
  ) {
    const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(1)}%`;
  }
  if (key === "cashRunwayMonths") {
    return `${value} months`;
  }
  if (
    key === "revenue" ||
    key === "ebitda" ||
    key === "operatingIncome" ||
    key === "cashBalance" ||
    key === "burnRateMonthly" ||
    key === "debt"
  ) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return String(value);
}

function citeSheet(fact: DoctorStructuredFact): string {
  const sheet = fact.worksheet ? `, sheet ${fact.worksheet}` : "";
  const period = fact.period ? `, period ${fact.period}` : "";
  return `${fact.evidenceTitle}${sheet}${period} [${fact.evidenceId}]`;
}

function detectIssues(facts: DoctorStructuredFact[]): DoctorFinancialIssue[] {
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const issues: DoctorFinancialIssue[] = [];

  const runway = byKey.get("cashRunwayMonths");
  if (runway) {
    if (runway.value < 6) {
      issues.push({
        id: "fin-runway-critical",
        title: "Short cash runway",
        summary: `Cash runway is ${formatMetric(runway)} — below a 6-month safety floor.`,
        severity: "high",
        confidence: 85,
        factKeys: ["cashRunwayMonths"],
        evidenceIds: [runway.evidenceId],
        nextAction: "Re-forecast burn and identify the fastest runway extension levers.",
      });
    } else if (runway.value < 12) {
      issues.push({
        id: "fin-runway-watch",
        title: "Runway under 12 months",
        summary: `Cash runway is ${formatMetric(runway)} — worth monitoring against plan.`,
        severity: "medium",
        confidence: 70,
        factKeys: ["cashRunwayMonths"],
        evidenceIds: [runway.evidenceId],
        nextAction: "Confirm base-case runway and set a funding / burn trigger.",
      });
    }
  }

  const growth = byKey.get("revenueGrowth");
  if (growth && growth.value < 0) {
    issues.push({
      id: "fin-revenue-decline",
      title: "Revenue declining",
      summary: `Revenue growth is ${formatMetric(growth)}.`,
      severity: growth.value < -0.1 ? "high" : "medium",
      confidence: 75,
      factKeys: ["revenueGrowth", "revenue"],
      evidenceIds: [growth.evidenceId],
      nextAction: "Isolate whether acquisition, churn, or expansion is driving the decline.",
    });
  }

  const concentration = byKey.get("top3CustomerArrShare");
  if (concentration) {
    const share =
      Math.abs(concentration.value) <= 1.5
        ? concentration.value
        : concentration.value / 100;
    if (share >= 0.4) {
      issues.push({
        id: "fin-concentration",
        title: "Customer concentration",
        summary: `Top customers represent ${formatMetric(concentration)} of ARR.`,
        severity: share >= 0.5 ? "high" : "medium",
        confidence: 80,
        factKeys: ["top3CustomerArrShare"],
        evidenceIds: [concentration.evidenceId],
        nextAction: "Diversify pipeline and strengthen retention on top accounts.",
      });
    }
  }

  const margin = byKey.get("grossMargin");
  if (margin) {
    const m = Math.abs(margin.value) <= 1.5 ? margin.value : margin.value / 100;
    if (m < 0.4) {
      issues.push({
        id: "fin-gross-margin",
        title: "Low gross margin",
        summary: `Gross margin is ${formatMetric(margin)}.`,
        severity: "medium",
        confidence: 65,
        factKeys: ["grossMargin"],
        evidenceIds: [margin.evidenceId],
        nextAction: "Review COGS drivers and pricing before scaling spend.",
      });
    }
  }

  const burn = byKey.get("burnRateMonthly");
  const cash = byKey.get("cashBalance");
  if (burn && cash && burn.value > 0 && cash.value / burn.value < 6) {
    // Only add if runway fact missing (avoid duplicate)
    if (!runway) {
      issues.push({
        id: "fin-implied-runway",
        title: "Implied runway under 6 months",
        summary: `Cash ${formatMetric(cash)} / monthly burn ${formatMetric(burn)} implies short runway.`,
        severity: "high",
        confidence: 60,
        factKeys: ["cashBalance", "burnRateMonthly"],
        evidenceIds: [cash.evidenceId, burn.evidenceId],
        nextAction: "Validate runway with an explicit cash forecast workbook.",
      });
    }
  }

  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  return issues.sort(
    (a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      b.confidence - a.confidence,
  );
}

function listUnknowns(facts: DoctorStructuredFact[]): string[] {
  const present = new Set(facts.map((f) => f.key));
  const unknowns: string[] = [];
  const desired: Array<{ key: FinancialFactKey; label: string }> = [
    { key: "cashRunwayMonths", label: "cash runway (months)" },
    { key: "revenueGrowth", label: "revenue growth rate" },
    { key: "churnRate", label: "churn / retention" },
    { key: "top3CustomerArrShare", label: "customer concentration" },
    { key: "grossMargin", label: "gross margin" },
  ];
  for (const d of desired) {
    if (!present.has(d.key)) unknowns.push(d.label);
  }
  return unknowns.slice(0, 4);
}

/**
 * Diagnose from structured financial facts in the current snapshot only.
 */
export function diagnoseFinancials(
  snapshot: Pick<CompanyHealthSnapshot, "evidence"> & {
    assessmentSnapshotId?: string | null;
  },
  options?: { snapshotId?: string | null },
): DoctorFinancialDiagnosis {
  const facts = collectStructuredFinancialFacts(snapshot);
  const issues = detectIssues(facts);
  const primary =
    issues.find((i) => i.confidence >= 55 && i.severity !== "low") ?? null;
  const highConfidenceCritical =
    issues.find((i) => i.confidence >= 70 && i.severity === "high") ?? null;

  return {
    facts,
    issues,
    primaryIssue: highConfidenceCritical ?? primary,
    noMaterialIssue: facts.length > 0 && !highConfidenceCritical && !primary,
    unknowns: listUnknowns(facts),
    snapshotId:
      options?.snapshotId ?? snapshot.assessmentSnapshotId ?? null,
  };
}

/** Compose a mentor-style answer from financial diagnosis. */
export function composeFinancialAnswer(input: {
  companyName: string;
  question: string;
  diagnosis: DoctorFinancialDiagnosis;
  preferRiskFraming?: boolean;
}): {
  answer: string;
  summary: string;
  confidence: number;
  riskLevel: "high" | "medium" | "low";
  evidenceIds: string[];
  nextAction: string | null;
  insufficientEvidence: boolean;
} {
  const { diagnosis, companyName } = input;
  if (diagnosis.facts.length === 0) {
    return {
      answer: `I do not yet have structured financial facts for ${companyName} in the current snapshot.`,
      summary: "No financial facts available.",
      confidence: 10,
      riskLevel: "low",
      evidenceIds: [],
      nextAction: "Upload a financial workbook with cash, burn, and revenue.",
      insufficientEvidence: true,
    };
  }

  const metricLines = diagnosis.facts.slice(0, 8).map((f) => {
    const period = f.period ? ` (${f.period})` : "";
    return `${f.key}: ${formatMetric(f)}${period} — ${citeSheet(f)}`;
  });

  if (diagnosis.primaryIssue) {
    const issue = diagnosis.primaryIssue;
    const unknownBit =
      diagnosis.unknowns.length > 0
        ? ` Still unknown: ${diagnosis.unknowns[0]}.`
        : "";
    return {
      answer: [
        `Observation: ${issue.summary}`,
        `Supporting metrics: ${metricLines.join("; ")}.`,
        `Confidence: ${issue.confidence}%.`,
        `What remains unknown:${unknownBit || " nothing material from the financial pack."}`,
        `Next action: ${issue.nextAction}`,
      ].join(" "),
      summary: issue.title,
      confidence: issue.confidence,
      riskLevel: issue.severity,
      evidenceIds: [...new Set(issue.evidenceIds)],
      nextAction: issue.nextAction,
      insufficientEvidence: false,
    };
  }

  // Facts exist, no material problem — do not manufacture a risk.
  const nextUncertainty =
    diagnosis.unknowns[0] ??
    "whether forecast vs actual is tracking plan";
  return {
    answer: [
      `I reviewed the available financial data and did not identify a high-confidence critical issue.`,
      `Supporting metrics: ${metricLines.join("; ")}.`,
      `Next largest uncertainty: ${nextUncertainty}.`,
      `One next action: confirm the single metric that would most reduce that uncertainty.`,
    ].join(" "),
    summary: "No high-confidence critical financial issue.",
    confidence: Math.min(
      80,
      40 + diagnosis.facts.length * 5,
    ),
    riskLevel: "low",
    evidenceIds: [...new Set(diagnosis.facts.map((f) => f.evidenceId))],
    nextAction: `Clarify ${nextUncertainty}.`,
    insufficientEvidence: false,
  };
}

/** Confidence floor for presenting an investigation as the primary problem. */
export const MIN_PRIMARY_INVESTIGATION_CONFIDENCE = 40;
