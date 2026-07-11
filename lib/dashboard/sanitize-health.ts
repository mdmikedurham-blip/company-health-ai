/**
 * Sanitize / normalize persisted health assessments for authenticated UI.
 * Strips legacy baseline-85 snapshots that were persisted without findings.
 */

import type {
  HealthDimension,
  HealthScore,
  ScoreChangeExplanation,
} from "@/lib/domain";
import { BASELINE_DIMENSION_SCORE } from "@/lib/intelligence/rules";

export type ScoreMethod = "findings_weighted" | "insufficient" | "none";
export type ConfidenceMethod = "evidence_coverage" | "none";

export type DimensionCoverage = {
  scored: number;
  total: number;
};

export function dimensionIsScored(d: Pick<HealthDimension, "scored" | "status" | "findingIds">): boolean {
  if (d.status === "insufficient") return false;
  if (d.scored === false) return false;
  if (d.scored === true) return true;
  // Legacy rows: treat presence of finding links as scored
  return (d.findingIds?.length ?? 0) > 0;
}

/**
 * Legacy rows wrote BASELINE_DIMENSION_SCORE for every dimension when
 * findings were empty. Those must never display as a real assessment.
 */
export function isLegacyBaselineOnlySnapshot(input: {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  findingsCount: number;
}): boolean {
  const { healthScore, dimensions, findingsCount } = input;
  if (findingsCount > 0) return false;
  if (dimensions.length === 0) {
    return healthScore.score === BASELINE_DIMENSION_SCORE;
  }
  const allBaseline =
    dimensions.every((d) => d.score === BASELINE_DIMENSION_SCORE) &&
    dimensions.every((d) => (d.findingIds?.length ?? 0) === 0);
  return allBaseline;
}

export function sanitizeHealthAssessment(input: {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation | null;
  findingsCount: number;
}): {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation;
} {
  const legacy = isLegacyBaselineOnlySnapshot(input);

  const dimensions = input.dimensions.map((d) => {
    const scored = legacy ? false : dimensionIsScored(d);
    if (scored) {
      return { ...d, scored: true };
    }
    return {
      ...d,
      scored: false,
      score: 0,
      status: "insufficient" as const,
      confidence: 0,
      summary: "Not enough evidence",
      topDrivers:
        d.topDrivers?.length && !legacy
          ? d.topDrivers
          : ["Not enough evidence"],
      trend: { direction: "flat" as const, value: 0 },
    };
  });

  const scoredCount = dimensions.filter((d) => d.scored).length;
  const scoreAvailable =
    !legacy &&
    input.healthScore.scoreAvailable !== false &&
    input.healthScore.status !== "insufficient" &&
    scoredCount > 0;

  const healthScore: HealthScore = scoreAvailable
    ? {
        ...input.healthScore,
        scoreAvailable: true,
      }
    : {
        ...input.healthScore,
        score: 0,
        scoreAvailable: false,
        status: "insufficient",
        change: 0,
        changeLabel: "No assessment yet",
        confidence: 0,
      };

  const rawChange = input.scoreChange;
  const hasPriorFromPayload = rawChange?.hasPriorSnapshot === true;
  const hasPrior = scoreAvailable && hasPriorFromPayload;

  // Without two real assessments, never show a fabricated delta.
  const scoreChange: ScoreChangeExplanation = rawChange
    ? {
        ...rawChange,
        hasPriorSnapshot: Boolean(hasPrior),
        previousScore: hasPrior ? rawChange.previousScore : healthScore.score,
        currentScore: healthScore.score,
        change: hasPrior ? rawChange.change : 0,
        summary: scoreAvailable
          ? hasPrior
            ? rawChange.summary
            : rawChange.summary.includes("No prior")
              ? rawChange.summary
              : "No prior assessment to compare."
          : "Not enough evidence to publish an overall health score.",
        drivers: scoreAvailable ? rawChange.drivers : [],
      }
    : {
        previousScore: healthScore.score,
        currentScore: healthScore.score,
        change: 0,
        hasPriorSnapshot: false,
        period: "Current assessment",
        summary: scoreAvailable
          ? "No prior assessment to compare."
          : "Not enough evidence to publish an overall health score.",
        drivers: [],
      };

  if (!scoreChange.hasPriorSnapshot) {
    healthScore.change = 0;
    healthScore.changeLabel = scoreAvailable
      ? "No prior assessment"
      : "No assessment yet";
  }

  return { healthScore, dimensions, scoreChange };
}

export function buildDimensionCoverage(
  dimensions: HealthDimension[],
): DimensionCoverage {
  return {
    scored: dimensions.filter((d) => d.scored).length,
    total: dimensions.length,
  };
}

export function deriveScoreMethod(
  healthScore: HealthScore,
): ScoreMethod {
  if (!healthScore.scoreAvailable || healthScore.status === "insufficient") {
    return healthScore.score === 0 && !healthScore.scoreAvailable
      ? "insufficient"
      : "insufficient";
  }
  return "findings_weighted";
}

export function deriveConfidenceMethod(
  healthScore: HealthScore,
): ConfidenceMethod {
  if (!healthScore.scoreAvailable || healthScore.confidence <= 0) {
    return "none";
  }
  return "evidence_coverage";
}

/** True when a persisted prior row is usable for period delta. */
export function isValidPriorAssessment(input: {
  score: number;
  status: string;
  dimensions?: HealthDimension[] | null;
  findingsCount?: number;
}): boolean {
  if (input.status === "insufficient") return false;
  if (
    isLegacyBaselineOnlySnapshot({
      healthScore: {
        score: input.score,
        scoreAvailable: true,
        status: input.status as HealthScore["status"],
        change: 0,
        changeLabel: "",
        lastUpdated: "",
        confidence: 0,
      },
      dimensions: input.dimensions ?? [],
      findingsCount: input.findingsCount ?? 0,
    })
  ) {
    return false;
  }
  return input.score > 0 || (input.dimensions?.some((d) => dimensionIsScored(d)) ?? false);
}
