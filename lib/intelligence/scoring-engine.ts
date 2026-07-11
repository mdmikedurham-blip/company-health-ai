/**
 * Scoring Engine — Findings → dimension scores → overall HealthScore.
 * All numeric policy comes from rules.ts.
 *
 * Dimensions without findings are NOT scored (no baseline-85 display).
 * Overall health exists only when enough dimensions are scored from findings.
 */

import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  ScoreChangeExplanation,
  ScoreImpactExplanation,
} from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/domain/dimensions";
import {
  BASELINE_DIMENSION_SCORE,
  CONFIDENCE_EMPTY,
  CONFIDENCE_FRESHNESS_DAYS,
  CONFIDENCE_FRESHNESS_FACTOR,
  CONFIDENCE_QUANTITY_SATURATION,
  CONFIDENCE_UNKNOWN_FRESHNESS,
  CONFIDENCE_WEIGHTS,
  DEFAULT_DIMENSION_WEIGHT,
  DIMENSION_WEIGHTS,
  MIN_SCORED_DIMENSIONS_FOR_OVERALL,
  clampScore,
  deriveStatus,
  deriveStatusOrInsufficient,
} from "./rules";

const MS_PER_DAY = 86_400_000;

function parseFreshnessDays(collectedAt: string, asOf: Date): number | null {
  const lower = collectedAt.toLowerCase();
  if (lower.includes("today") || lower.includes("just now") || lower.includes("hour")) {
    return 0;
  }
  if (lower.includes("yesterday")) return 1;
  const iso = Date.parse(collectedAt);
  if (!Number.isNaN(iso)) {
    return Math.max(0, (asOf.getTime() - iso) / MS_PER_DAY);
  }
  return null;
}

export function calculateConfidence(evidence: Evidence[], asOf: Date): number {
  if (evidence.length === 0) return CONFIDENCE_EMPTY;

  const reliabilityAvg =
    evidence.reduce((sum, e) => sum + e.reliability, 0) / evidence.length;

  const quantityFactor = Math.min(1, evidence.length / CONFIDENCE_QUANTITY_SATURATION);

  const freshnessScores = evidence.map((e) => {
    const days = parseFreshnessDays(e.collectedAt, asOf);
    if (days === null) return CONFIDENCE_UNKNOWN_FRESHNESS;
    if (days <= CONFIDENCE_FRESHNESS_DAYS.excellent) {
      return CONFIDENCE_FRESHNESS_FACTOR.excellent;
    }
    if (days <= CONFIDENCE_FRESHNESS_DAYS.good) {
      return CONFIDENCE_FRESHNESS_FACTOR.good;
    }
    if (days <= CONFIDENCE_FRESHNESS_DAYS.fair) {
      return CONFIDENCE_FRESHNESS_FACTOR.fair;
    }
    return CONFIDENCE_FRESHNESS_FACTOR.poor;
  });
  const freshnessAvg =
    freshnessScores.reduce((sum, s) => sum + s, 0) / freshnessScores.length;

  const score =
    reliabilityAvg * CONFIDENCE_WEIGHTS.reliability +
    quantityFactor * 100 * CONFIDENCE_WEIGHTS.quantity +
    freshnessAvg * 100 * CONFIDENCE_WEIGHTS.freshness;

  return clampScore(score);
}

export function calculateDimensionScores(
  findings: Finding[],
  evidence: Evidence[],
  dimensionIds: string[] = Object.keys(DIMENSION_WEIGHTS),
  asOf: Date,
): {
  dimensions: HealthDimension[];
  explanations: ScoreImpactExplanation[];
} {
  const explanations: ScoreImpactExplanation[] = [];
  const dimensions: HealthDimension[] = [];

  for (const dimensionId of dimensionIds) {
    const dimFindings = findings.filter((f) => f.dimensionId === dimensionId);
    const dimEvidence = evidence.filter(
      (e) => e.dimensionId === dimensionId || e.dimensionIds.includes(dimensionId),
    );

    const scored = dimFindings.length > 0;
    const impacts: ScoreImpactExplanation["impacts"] = [];

    let finalScore = 0;
    if (scored) {
      let score = BASELINE_DIMENSION_SCORE;
      for (const finding of dimFindings) {
        score += finding.scoreImpact;
        impacts.push({
          findingId: finding.id,
          impact: finding.scoreImpact,
          reason: finding.title,
          evidenceIds: finding.evidenceIds,
        });
      }
      finalScore = clampScore(score);
    }

    const confidence = scored
      ? calculateConfidence(dimEvidence, asOf)
      : CONFIDENCE_EMPTY;

    explanations.push({
      dimensionId,
      baselineScore: scored ? BASELINE_DIMENSION_SCORE : 0,
      finalScore,
      impacts,
    });

    const topDrivers = dimFindings
      .slice()
      .sort((a, b) => Math.abs(b.scoreImpact) - Math.abs(a.scoreImpact))
      .slice(0, 3)
      .map((f) => f.title);

    const negativeFindings = dimFindings.filter((f) => f.direction === "negative");
    const positiveFindings = dimFindings.filter((f) => f.direction === "positive");

    let summary: string;
    if (!scored) {
      summary = "Not enough evidence";
    } else if (negativeFindings.length > 0) {
      summary = negativeFindings.map((f) => f.description).join(" ");
    } else {
      summary = positiveFindings.map((f) => f.description).join(" ");
    }

    const netImpact = scored ? finalScore - BASELINE_DIMENSION_SCORE : 0;
    const trend =
      !scored
        ? ({ direction: "flat" as const, value: 0 })
        : netImpact > 0
          ? ({ direction: "up" as const, value: Math.abs(netImpact) })
          : netImpact < 0
            ? ({ direction: "down" as const, value: Math.abs(netImpact) })
            : ({ direction: "flat" as const, value: 0 });

    dimensions.push({
      id: dimensionId,
      name: DIMENSION_NAMES[dimensionId] ?? dimensionId,
      score: finalScore,
      scored,
      trend,
      status: deriveStatusOrInsufficient(scored, finalScore),
      confidence,
      evidenceCount: dimEvidence.length,
      owner: "",
      summary,
      topDrivers: scored
        ? topDrivers.length > 0
          ? topDrivers
          : []
        : ["Not enough evidence"],
      evidenceIds: dimEvidence.map((e) => e.id),
      findingIds: dimFindings.map((f) => f.id),
      recommendedActions: [],
      whyItMatters: `${DIMENSION_NAMES[dimensionId] ?? dimensionId} health contributes to overall company readiness.`,
      estimatedScoreImprovement: Math.max(
        0,
        ...dimFindings
          .filter((f) => f.direction === "negative")
          .map((f) => Math.abs(f.scoreImpact)),
        0,
      ),
      weight: DIMENSION_WEIGHTS[dimensionId] ?? DEFAULT_DIMENSION_WEIGHT,
    });
  }

  return { dimensions, explanations };
}

function formatLastUpdated(asOf: Date): string {
  return asOf.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function calculateOverallHealth(
  dimensions: HealthDimension[],
  evidence: Evidence[],
  previousHealthScore: HealthScore | undefined,
  asOf: Date,
): HealthScore {
  const scoredDims = dimensions.filter((d) => d.scored !== false && d.status !== "insufficient");
  const scoreAvailable = scoredDims.length >= MIN_SCORED_DIMENSIONS_FOR_OVERALL;

  if (!scoreAvailable) {
    return {
      score: 0,
      scoreAvailable: false,
      status: "insufficient",
      change: 0,
      changeLabel: "No assessment yet",
      lastUpdated: formatLastUpdated(asOf),
      confidence: CONFIDENCE_EMPTY,
    };
  }

  const totalWeight = scoredDims.reduce(
    (sum, d) =>
      sum + (d.weight ?? DIMENSION_WEIGHTS[d.id] ?? DEFAULT_DIMENSION_WEIGHT),
    0,
  );

  const weighted =
    totalWeight === 0
      ? 0
      : scoredDims.reduce((sum, d) => {
          const w = d.weight ?? DIMENSION_WEIGHTS[d.id] ?? DEFAULT_DIMENSION_WEIGHT;
          return sum + d.score * w;
        }, 0) / totalWeight;

  const score = clampScore(weighted);

  // Confidence from evidence that actually supports scored dimensions / findings.
  const scoredEvidenceIds = new Set(scoredDims.flatMap((d) => d.evidenceIds));
  const supportingEvidence =
    scoredEvidenceIds.size > 0
      ? evidence.filter((e) => scoredEvidenceIds.has(e.id))
      : evidence;
  const confidence = calculateConfidence(supportingEvidence, asOf);

  const priorAvailable = previousHealthScore?.scoreAvailable !== false &&
    previousHealthScore != null &&
    previousHealthScore.status !== "insufficient";
  const previous = priorAvailable ? previousHealthScore!.score : score;
  const change = priorAvailable ? score - previous : 0;

  return {
    score,
    scoreAvailable: true,
    status: deriveStatus(score),
    change,
    changeLabel: priorAvailable
      ? change > 0
        ? `+${change} vs prior`
        : change < 0
          ? `${change} vs prior`
          : "unchanged"
      : "No prior assessment",
    lastUpdated: formatLastUpdated(asOf),
    confidence,
  };
}

export function buildScoreChangeExplanation(
  healthScore: HealthScore,
  explanations: ScoreImpactExplanation[],
  findings: Finding[],
  previousHealthScore?: HealthScore,
  previousDimensions?: Pick<HealthDimension, "id" | "score" | "scored">[],
): ScoreChangeExplanation {
  const hasPriorSnapshot =
    previousHealthScore != null &&
    previousHealthScore.scoreAvailable !== false &&
    previousHealthScore.status !== "insufficient";

  const previousScore = hasPriorSnapshot
    ? previousHealthScore!.score
    : healthScore.score;
  const priorById = new Map(
    (previousDimensions ?? []).map((d) => [d.id, d.score]),
  );

  const drivers = explanations
    .filter((e) => e.impacts.length > 0)
    .map((e) => {
      const currentScoreImpact = e.finalScore - e.baselineScore;
      const priorDim = priorById.get(e.dimensionId);
      const periodDelta =
        hasPriorSnapshot && priorDim !== undefined
          ? e.finalScore - priorDim
          : 0;
      const primary = e.impacts[0];
      return {
        dimension: DIMENSION_NAMES[e.dimensionId] ?? e.dimensionId,
        currentScoreImpact,
        periodDelta,
        reason: primary?.reason ?? "Score adjustment from findings",
        findingIds: e.impacts.map((i) => i.findingId),
        evidenceIds: [...new Set(e.impacts.flatMap((i) => i.evidenceIds))],
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.currentScoreImpact) - Math.abs(a.currentScoreImpact),
    );

  const periodChange = hasPriorSnapshot
    ? healthScore.score - previousScore
    : 0;

  const scoreAvailable = healthScore.scoreAvailable !== false;

  let summary: string;
  if (!scoreAvailable) {
    summary =
      "Not enough evidence to publish an overall health score. Upload documents that produce findings for at least one dimension.";
  } else if (findings.length === 0) {
    summary = "Not enough evidence to explain score movement.";
  } else if (hasPriorSnapshot) {
    summary = `Health ${previousScore} → ${healthScore.score} (${formatSigned(periodChange)}) based on ${findings.length} finding${findings.length === 1 ? "" : "s"}. Composition drivers show current score impact vs baseline; period deltas show change vs prior.`;
  } else {
    summary = `Health at ${healthScore.score} based on ${findings.length} finding${findings.length === 1 ? "" : "s"} across scored dimensions. No prior assessment to compare.`;
  }

  return {
    previousScore,
    currentScore: scoreAvailable ? healthScore.score : 0,
    change: periodChange,
    hasPriorSnapshot,
    period: "Current assessment",
    summary,
    drivers,
  };
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function computeHealthFromFindings(
  findings: Finding[],
  evidence: Evidence[],
  previousHealthScore: HealthScore | undefined,
  dimensionProfiles: HealthDimension[] | undefined,
  asOf: Date,
): {
  dimensions: HealthDimension[];
  healthScore: HealthScore;
  scoreChange: ScoreChangeExplanation;
  explanations: ScoreImpactExplanation[];
} {
  const dimensionIds =
    dimensionProfiles && dimensionProfiles.length > 0
      ? dimensionProfiles.map((d) => d.id)
      : Object.keys(DIMENSION_WEIGHTS);

  const { dimensions: scored, explanations } = calculateDimensionScores(
    findings,
    evidence,
    dimensionIds,
    asOf,
  );

  const dimensions = scored.map((d) => {
    const profile = dimensionProfiles?.find((p) => p.id === d.id);
    if (!profile) return d;
    return {
      ...d,
      owner: profile.owner || d.owner,
      whyItMatters: profile.whyItMatters || d.whyItMatters,
      weight: profile.weight ?? d.weight,
      recommendedActions:
        profile.recommendedActions.length > 0
          ? profile.recommendedActions
          : d.recommendedActions,
    };
  });

  const healthScore = calculateOverallHealth(
    dimensions,
    evidence,
    previousHealthScore,
    asOf,
  );
  healthScore.scoreExplanations = explanations;

  const scoreChange = buildScoreChangeExplanation(
    healthScore,
    explanations,
    findings,
    previousHealthScore,
    previousDimensionsFrom(previousHealthScore),
  );

  return { dimensions, healthScore, scoreChange, explanations };
}

function previousDimensionsFrom(
  previous: HealthScore | undefined,
): Pick<HealthDimension, "id" | "score" | "scored">[] | undefined {
  if (!previous?.scoreExplanations?.length) return undefined;
  return previous.scoreExplanations.map((e) => ({
    id: e.dimensionId,
    score: e.finalScore,
    scored: e.impacts.length > 0,
  }));
}
