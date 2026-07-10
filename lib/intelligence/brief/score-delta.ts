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
 * Period deltas require a real prior dimension score. When prior
 * dimensions are absent, periodDelta is 0 — never invent change from
 * baseline composition (currentScoreImpact lives on ScoreChangeDriver).
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
  const hasPriorDimensions = priorById.size > 0;

  const byDimension: DimensionScoreDelta[] = [...params.dimensions]
    .map((d) => {
      const prior = priorById.get(d.id);
      const previousDimScore = hasPriorDimensions ? (prior ?? d.score) : d.score;
      const dimChange = hasPriorDimensions ? d.score - previousDimScore : 0;
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
