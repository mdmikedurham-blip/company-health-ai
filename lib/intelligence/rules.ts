/**
 * Insight Engine policy — every numeric threshold, weight, multiplier,
 * score adjustment, and priority band lives here.
 *
 * This is the future policy engine: change behavior by editing this file,
 * not by scattering magic numbers across analyzers.
 */

import type { EffortLevel, FindingDirection, RiskSeverity } from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/domain/dimensions";

// ─── Baseline & status ───────────────────────────────────────────────────────

export const BASELINE_DIMENSION_SCORE = 85;

export const STATUS_HEALTHY_MIN = 85;
export const STATUS_WATCH_MIN = 70;

/** Default weights for overall health (must sum ≈ 1.0). */
export const DIMENSION_WEIGHTS: Record<string, number> = {
  "dim-financial": 0.14,
  "dim-revenue-quality": 0.12,
  "dim-customer": 0.12,
  "dim-legal": 0.1,
  "dim-governance": 0.1,
  "dim-security": 0.1,
  "dim-people": 0.1,
  "dim-operations": 0.08,
  "dim-product": 0.08,
  "dim-ai-readiness": 0.06,
};

export const DEFAULT_DIMENSION_WEIGHT = 0.1;

export { DIMENSION_NAMES };

// ─── Detection thresholds ────────────────────────────────────────────────────

export const CONCENTRATION_HIGH = 0.5;
export const CONCENTRATION_MEDIUM = 0.35;

export const RUNWAY_HIGH_RISK = 6;
export const RUNWAY_MEDIUM_RISK = 12;
export const RUNWAY_POSITIVE = 18;

export const RECURRING_REVENUE_POSITIVE = 0.8;
export const NRR_RISK_THRESHOLD = 0.9;

export const MFA_COVERAGE_THRESHOLD = 0.95;

export const LOW_ATTRITION_THRESHOLD = 0.08;

// ─── Finding score impacts & materiality ─────────────────────────────────────

export type RuleId =
  | "concentration-high"
  | "concentration-medium"
  | "ip-gap"
  | "board-approval"
  | "runway-high"
  | "runway-medium"
  | "runway-positive"
  | "recurring-revenue"
  | "nrr"
  | "critical-controls"
  | "mfa"
  | "low-attrition"
  | "key-person";

export interface FindingPolicy {
  findingId: string;
  title: string;
  dimensionId: string;
  direction: FindingDirection;
  materiality: number;
  scoreImpact: number;
}

/** Per-rule finding policy applied when an insight of that ruleId is present. */
export const FINDING_POLICY: Record<RuleId, FindingPolicy> = {
  "concentration-high": {
    findingId: "finding-concentration",
    title: "Revenue concentration above 50% threshold",
    dimensionId: "dim-customer",
    direction: "negative",
    materiality: 9,
    scoreImpact: -8,
  },
  "concentration-medium": {
    findingId: "finding-concentration",
    title: "Elevated customer concentration",
    dimensionId: "dim-customer",
    direction: "negative",
    materiality: 6,
    scoreImpact: -4,
  },
  "ip-gap": {
    findingId: "finding-ip-gap",
    title: "Missing intellectual-property assignments",
    dimensionId: "dim-legal",
    direction: "negative",
    materiality: 7,
    scoreImpact: -6,
  },
  "board-approval": {
    findingId: "finding-board-approval",
    title: "Missing board approvals",
    dimensionId: "dim-governance",
    direction: "negative",
    materiality: 8,
    scoreImpact: -14,
  },
  "runway-high": {
    findingId: "finding-runway",
    title: "Cash runway concern",
    dimensionId: "dim-financial",
    direction: "negative",
    materiality: 9,
    scoreImpact: -12,
  },
  "runway-medium": {
    findingId: "finding-runway",
    title: "Cash runway concern",
    dimensionId: "dim-financial",
    direction: "negative",
    materiality: 6,
    scoreImpact: -6,
  },
  "runway-positive": {
    findingId: "finding-runway",
    title: "Strong cash runway",
    dimensionId: "dim-financial",
    direction: "positive",
    materiality: 5,
    scoreImpact: 5,
  },
  "recurring-revenue": {
    findingId: "finding-recurring-revenue",
    title: "High recurring revenue quality",
    dimensionId: "dim-revenue-quality",
    direction: "positive",
    materiality: 5,
    scoreImpact: 4,
  },
  nrr: {
    findingId: "finding-nrr",
    title: "Net revenue retention below threshold",
    dimensionId: "dim-revenue-quality",
    direction: "negative",
    materiality: 8,
    scoreImpact: -8,
  },
  "critical-controls": {
    findingId: "finding-security-readiness",
    title: "Security readiness gaps",
    dimensionId: "dim-security",
    direction: "negative",
    materiality: 7,
    scoreImpact: -8,
  },
  mfa: {
    findingId: "finding-security-readiness",
    title: "Security readiness gaps",
    dimensionId: "dim-security",
    direction: "negative",
    materiality: 7,
    scoreImpact: -8,
  },
  "low-attrition": {
    findingId: "finding-low-attrition",
    title: "Low voluntary attrition",
    dimensionId: "dim-people",
    direction: "positive",
    materiality: 4,
    scoreImpact: 5,
  },
  "key-person": {
    findingId: "finding-key-person",
    title: "Key-person dependency",
    dimensionId: "dim-people",
    direction: "negative",
    materiality: 7,
    scoreImpact: -5,
  },
};

/**
 * When multiple ruleIds map to the same findingId (e.g. critical-controls + mfa),
 * merge by taking the max materiality and summing score impacts (then clamp later).
 */
export const SECURITY_RULE_IDS: RuleId[] = ["critical-controls", "mfa"];

// ─── Risk severity derivation ────────────────────────────────────────────────

export const SEVERITY_HIGH_MATERIALITY_MIN = 8;
export const SEVERITY_HIGH_SCORE_IMPACT_MAX = -10;
export const SEVERITY_MEDIUM_MATERIALITY_MIN = 6;
export const SEVERITY_MEDIUM_SCORE_IMPACT_MAX = -5;
export const RISK_IMPACT_NORMALIZER = 15;

export const SEVERITY_MULTIPLIER: Record<RiskSeverity, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.6,
};

// ─── Recommendation priority ─────────────────────────────────────────────────

export const EFFORT_MULTIPLIER: Record<EffortLevel, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.5,
};

export const PRIORITY_HIGH_MIN = 8;
export const PRIORITY_MEDIUM_MIN = 4;

export const CONCENTRATION_TARGET = 0.45;

// ─── Confidence model ────────────────────────────────────────────────────────

export const CONFIDENCE_EMPTY = 40;
export const CONFIDENCE_QUANTITY_SATURATION = 8;
export const CONFIDENCE_UNKNOWN_FRESHNESS = 0.7;
export const CONFIDENCE_FRESHNESS_DAYS = {
  excellent: 7,
  good: 30,
  fair: 90,
} as const;
export const CONFIDENCE_FRESHNESS_FACTOR = {
  excellent: 1,
  good: 0.85,
  fair: 0.65,
  poor: 0.45,
} as const;
export const CONFIDENCE_WEIGHTS = {
  reliability: 0.5,
  quantity: 0.25,
  freshness: 0.25,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

/**
 * Normalize a percentage-like value to a 0–1+ ratio.
 *
 * Accepts both storage forms used in the corpus:
 * - Decimal ratios: `0.58`, `1.08` (NRR 108%)
 * - Whole-number percents: `58`, `108`
 *
 * Heuristic: values ≤ 1 stay as ratios; non-integer values in (1, 10)
 * stay as ratio multipliers (e.g. NRR `1.08`); integers and values ≥ 10
 * are treated as percent points and divided by 100.
 */
export function asRatio(value: unknown): number | null {
  const n = asNumber(value);
  if (n === null) return null;
  if (n <= 1) return n;
  if (Number.isInteger(n) || n >= 10) return n / 100;
  return n;
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveStatus(score: number): "healthy" | "watch" | "at-risk" {
  if (score >= STATUS_HEALTHY_MIN) return "healthy";
  if (score >= STATUS_WATCH_MIN) return "watch";
  return "at-risk";
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}

export function deriveRiskSeverity(
  materiality: number,
  scoreImpact: number,
): RiskSeverity {
  if (
    materiality >= SEVERITY_HIGH_MATERIALITY_MIN ||
    scoreImpact <= SEVERITY_HIGH_SCORE_IMPACT_MAX
  ) {
    return "high";
  }
  if (
    materiality >= SEVERITY_MEDIUM_MATERIALITY_MIN ||
    scoreImpact <= SEVERITY_MEDIUM_SCORE_IMPACT_MAX
  ) {
    return "medium";
  }
  return "low";
}

export function normalizeRiskImpact(scoreImpact: number): number {
  return Math.min(1, Math.abs(scoreImpact) / RISK_IMPACT_NORMALIZER);
}

export function priorityFromScore(score: number): "high" | "medium" | "low" {
  if (score >= PRIORITY_HIGH_MIN) return "high";
  if (score >= PRIORITY_MEDIUM_MIN) return "medium";
  return "low";
}
