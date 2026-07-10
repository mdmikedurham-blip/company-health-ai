/**
 * Deterministic rule constants and helpers for the Insight Engine.
 * Rules read Evidence.extractedFacts — an LLM can populate facts later without changing these rules.
 */

import type { EffortLevel, RiskSeverity } from "@/lib/domain";

export const BASELINE_DIMENSION_SCORE = 85;

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

export const DIMENSION_NAMES: Record<string, string> = {
  "dim-financial": "Financial",
  "dim-revenue-quality": "Revenue Quality",
  "dim-customer": "Customer",
  "dim-legal": "Legal",
  "dim-governance": "Governance",
  "dim-people": "People",
  "dim-security": "Security",
  "dim-operations": "Operations",
  "dim-product": "Product",
  "dim-ai-readiness": "AI Readiness",
};

export const SEVERITY_MULTIPLIER: Record<RiskSeverity, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.6,
};

export const EFFORT_MULTIPLIER: Record<EffortLevel, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.5,
};

/** Customer concentration thresholds (top-3 ARR share as fraction 0–1 or percent). */
export const CONCENTRATION_HIGH = 0.5;
export const CONCENTRATION_MEDIUM = 0.35;

/** Cash runway thresholds (months). */
export const RUNWAY_HIGH_RISK = 6;
export const RUNWAY_MEDIUM_RISK = 12;
export const RUNWAY_POSITIVE = 18;

/** Revenue quality thresholds. */
export const RECURRING_REVENUE_POSITIVE = 0.8;
export const NRR_RISK_THRESHOLD = 0.9;

/** Security thresholds. */
export const MFA_COVERAGE_THRESHOLD = 0.95;

/** People health. */
export const LOW_ATTRITION_THRESHOLD = 0.08;

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

/** Normalize a ratio that may be stored as 0–1 or 0–100. */
export function asRatio(value: unknown): number | null {
  const n = asNumber(value);
  if (n === null) return null;
  return n > 1 ? n / 100 : n;
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveStatus(score: number): "healthy" | "watch" | "at-risk" {
  if (score >= 85) return "healthy";
  if (score >= 70) return "watch";
  return "at-risk";
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}
