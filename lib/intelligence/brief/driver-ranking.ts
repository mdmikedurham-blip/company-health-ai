import type { CausalDriver } from "./brief-types";
import { materialityMultiplier } from "./materiality";

const PRIMARY_LIMIT = 3;
const SECONDARY_LIMIT = 3;

/**
 * Rank causal drivers by weighted impact:
 *   abs(impact) × (confidence/100) × (evidenceQuality/100) × materialityMultiplier
 *
 * Ties break on business materiality, then |impact|, then confidence, then stable id.
 */
export function rankDrivers(drivers: CausalDriver[]): CausalDriver[] {
  return [...drivers].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    const mat =
      materialityMultiplier(b.businessMateriality) -
      materialityMultiplier(a.businessMateriality);
    if (mat !== 0) return mat;
    const absImpact = Math.abs(b.impact) - Math.abs(a.impact);
    if (absImpact !== 0) return absImpact;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.id.localeCompare(b.id);
  });
}

export function splitPrimarySecondary(drivers: CausalDriver[]): {
  primaryDrivers: CausalDriver[];
  secondaryDrivers: CausalDriver[];
} {
  const ranked = rankDrivers(drivers);
  return {
    primaryDrivers: ranked.slice(0, PRIMARY_LIMIT),
    secondaryDrivers: ranked.slice(PRIMARY_LIMIT, PRIMARY_LIMIT + SECONDARY_LIMIT),
  };
}

export function computeWeightedScore(
  impact: number,
  confidence: number,
  evidenceQuality: number,
  businessMateriality: CausalDriver["businessMateriality"] = "medium",
): number {
  const conf = clamp01(confidence / 100);
  const quality = clamp01(evidenceQuality / 100);
  const mat = materialityMultiplier(businessMateriality);
  // Round to 4 decimals for stable equality across runs
  return Math.round(Math.abs(impact) * conf * quality * mat * 10000) / 10000;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
