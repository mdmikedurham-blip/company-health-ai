/**
 * Assessment-goal weights for value drivers.
 * Goals change prioritization only — never fabricate new evidence.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { ValueDriverKey } from "@/lib/domain/value-navigator";

/** Higher = more important under this goal. */
export const DRIVER_GOAL_WEIGHTS: Record<
  ValueDriverKey,
  Partial<Record<AssessmentGoalId, number>>
> = {
  "customer-concentration": {
    "run-the-company": 1.2,
    "raise-capital": 1.5,
    "sell-the-company": 1.6,
    "acquire-a-company": 1.3,
    "enterprise-sales": 1.1,
    "ipo-readiness": 1.4,
  },
  "recurring-revenue": {
    "run-the-company": 1.1,
    "raise-capital": 1.4,
    "sell-the-company": 1.5,
    "ipo-readiness": 1.3,
  },
  "gross-margin": {
    "run-the-company": 1.2,
    "raise-capital": 1.3,
    "sell-the-company": 1.4,
    "ipo-readiness": 1.3,
  },
  "cash-runway": {
    "run-the-company": 1.6,
    "raise-capital": 1.5,
    "sell-the-company": 1.0,
    "acquire-a-company": 1.2,
  },
  "revenue-growth": {
    "run-the-company": 1.3,
    "raise-capital": 1.6,
    "sell-the-company": 1.5,
    "ipo-readiness": 1.4,
  },
  governance: {
    "run-the-company": 0.9,
    "raise-capital": 1.2,
    "sell-the-company": 1.3,
    "board-readiness": 1.7,
    "ipo-readiness": 1.6,
    "annual-audit": 1.5,
  },
  soc2: {
    "run-the-company": 0.8,
    "enterprise-sales": 1.8,
    "raise-capital": 1.1,
    "sell-the-company": 1.2,
    "ipo-readiness": 1.3,
  },
  leadership: {
    "run-the-company": 1.1,
    "raise-capital": 1.3,
    "sell-the-company": 1.4,
    "ipo-readiness": 1.2,
  },
  "sales-efficiency": {
    "run-the-company": 1.2,
    "raise-capital": 1.3,
    "sell-the-company": 1.2,
  },
  "product-execution": {
    "run-the-company": 1.2,
    "raise-capital": 1.2,
    "sell-the-company": 1.3,
    "acquire-a-company": 1.4,
  },
  pricing: {
    "run-the-company": 1.3,
    "raise-capital": 1.2,
    "sell-the-company": 1.3,
  },
};

export function driverGoalWeight(
  key: ValueDriverKey,
  goal: AssessmentGoalId,
): number {
  return DRIVER_GOAL_WEIGHTS[key]?.[goal] ?? 1;
}

/** Goal-level value creation intent (presentation). */
export const GOAL_VALUE_INTENT: Record<AssessmentGoalId, string> = {
  "run-the-company": "maximize enterprise value",
  "raise-capital": "maximize investor readiness",
  "sell-the-company": "maximize exit value",
  "acquire-a-company": "maximize acquisition quality",
  "board-readiness": "maximize board confidence",
  "enterprise-sales": "maximize enterprise trust",
  "annual-audit": "maximize audit readiness",
  "ipo-readiness": "maximize public-company readiness",
};
