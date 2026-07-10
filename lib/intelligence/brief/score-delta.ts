import type { HealthDimension, HealthScore } from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/intelligence/rules";
import type {
  BriefPreviousSlice,
  DimensionScoreDelta,
  ScoreDeltaResult,
} from "./brief-types";

/**
 * Compare current health against a previous slice and compute
 * overall + per-dimension score deltas.
 *
 * When prior dimension scores are absent, uses finding net impact
 * relative to current dimension score as the delta proxy so drivers
 * remain attributable without inventing a prior snapshot.
 */
export function computeScoreDelta(params: {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  previous?: BriefPreviousSlice;
}): ScoreDeltaResult {
  const previousScore = params.previous?.healthScore.score ?? params.healthScore.score;
  const currentScore = params.healthScore.score;
  const change = currentScore - previousScore;

  const priorById = new Map(
    (params.previous?.dimensions ?? []).map((d) => [d.id, d.score]),
  );

  const byDimension: DimensionScoreDelta[] = [...params.dimensions]
    .map((d) => {
      const prior = priorById.get(d.id);
      const previousDimScore =
        prior ??
        // No prior dimension: attribute change from finding impacts on this dim
        d.score -
          (params.healthScore.scoreExplanations
            ?.find((e) => e.dimensionId === d.id)
            ?.impacts.reduce((sum, i) => sum + i.impact, 0) ?? 0);
      const dimChange = d.score - previousDimScore;
      return {
        dimensionId: d.id,
        dimension: d.name || DIMENSION_NAMES[d.id] || d.id,
        previousScore: previousDimScore,
        currentScore: d.score,
        change: dimChange,
      };
    })
    .sort((a, b) => {
      const absDiff = Math.abs(b.change) - Math.abs(a.change);
      if (absDiff !== 0) return absDiff;
      return a.dimensionId.localeCompare(b.dimensionId);
    });

  return {
    previousScore,
    currentScore,
    change,
    byDimension,
  };
}
