/**
 * Scoring Engine — Findings → dimension scores → overall HealthScore.
 *
 * - Every dimension starts at BASELINE_DIMENSION_SCORE (85).
 * - Positive/negative finding impacts are applied.
 * - Overall health is a weighted average of dimensions.
 * - Confidence reflects evidence quantity, freshness, and reliability — never invents conclusions.
 */

import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  ScoreChangeExplanation,
  ScoreImpactExplanation,
} from "@/lib/domain";
import {
  BASELINE_DIMENSION_SCORE,
  DIMENSION_NAMES,
  DIMENSION_WEIGHTS,
  clampScore,
  deriveStatus,
} from "./rules";

const MS_PER_DAY = 86_400_000;

function parseFreshnessDays(collectedAt: string, now = new Date()): number | null {
  // Accept ISO dates; relative labels ("Today", "Yesterday") count as fresh.
  const lower = collectedAt.toLowerCase();
  if (lower.includes("today") || lower.includes("just now") || lower.includes("hour")) {
    return 0;
  }
  if (lower.includes("yesterday")) return 1;
  const iso = Date.parse(collectedAt);
  if (!Number.isNaN(iso)) {
    return Math.max(0, (now.getTime() - iso) / MS_PER_DAY);
  }
  return null;
}

/**
 * Confidence from evidence quantity, freshness, and reliability.
 * Missing evidence reduces confidence — it does not invent scores.
 */
export function calculateConfidence(evidence: Evidence[], now = new Date()): number {
  if (evidence.length === 0) return 40;

  const reliabilityAvg =
    evidence.reduce((sum, e) => sum + e.reliability, 0) / evidence.length;

  const quantityFactor = Math.min(1, evidence.length / 8);

  const freshnessScores = evidence.map((e) => {
    const days = parseFreshnessDays(e.collectedAt, now);
    if (days === null) return 0.7;
    if (days <= 7) return 1;
    if (days <= 30) return 0.85;
    if (days <= 90) return 0.65;
    return 0.45;
  });
  const freshnessAvg =
    freshnessScores.reduce((sum, s) => sum + s, 0) / freshnessScores.length;

  const score =
    reliabilityAvg * 0.5 + quantityFactor * 100 * 0.25 + freshnessAvg * 100 * 0.25;

  return clampScore(score);
}

export function calculateDimensionScores(
  findings: Finding[],
  evidence: Evidence[],
  dimensionIds: string[] = Object.keys(DIMENSION_WEIGHTS),
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

    let score = BASELINE_DIMENSION_SCORE;
    const impacts: ScoreImpactExplanation["impacts"] = [];

    for (const finding of dimFindings) {
      score += finding.scoreImpact;
      impacts.push({
        findingId: finding.id,
        impact: finding.scoreImpact,
        reason: finding.title,
        evidenceIds: finding.evidenceIds,
      });
    }

    const finalScore = clampScore(score);
    const confidence = calculateConfidence(dimEvidence);

    explanations.push({
      dimensionId,
      baselineScore: BASELINE_DIMENSION_SCORE,
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
    if (dimFindings.length === 0) {
      summary = `No material findings for ${DIMENSION_NAMES[dimensionId] ?? dimensionId}. Score held at baseline; confidence reduced until evidence is available.`;
    } else if (negativeFindings.length > 0) {
      summary = negativeFindings.map((f) => f.description).join(" ");
    } else {
      summary = positiveFindings.map((f) => f.description).join(" ");
    }

    const netImpact = finalScore - BASELINE_DIMENSION_SCORE;
    const trend =
      netImpact > 0
        ? ({ direction: "up" as const, value: Math.abs(netImpact) })
        : netImpact < 0
          ? ({ direction: "down" as const, value: Math.abs(netImpact) })
          : ({ direction: "flat" as const, value: 0 });

    dimensions.push({
      id: dimensionId,
      name: DIMENSION_NAMES[dimensionId] ?? dimensionId,
      score: finalScore,
      trend,
      status: deriveStatus(finalScore),
      confidence,
      evidenceCount: dimEvidence.length,
      owner: "",
      summary,
      topDrivers: topDrivers.length > 0 ? topDrivers : ["Baseline — awaiting evidence"],
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
      weight: DIMENSION_WEIGHTS[dimensionId] ?? 0.1,
    });
  }

  return { dimensions, explanations };
}

export function calculateOverallHealth(
  dimensions: HealthDimension[],
  evidence: Evidence[],
  previousHealthScore?: HealthScore,
): HealthScore {
  const totalWeight = dimensions.reduce(
    (sum, d) => sum + (d.weight ?? DIMENSION_WEIGHTS[d.id] ?? 0.1),
    0,
  );

  const weighted =
    totalWeight === 0
      ? BASELINE_DIMENSION_SCORE
      : dimensions.reduce((sum, d) => {
          const w = d.weight ?? DIMENSION_WEIGHTS[d.id] ?? 0.1;
          return sum + d.score * w;
        }, 0) / totalWeight;

  const score = clampScore(weighted);
  const confidence = calculateConfidence(evidence);
  const previous = previousHealthScore?.score ?? score;
  const change = score - previous;

  return {
    score,
    status: deriveStatus(score),
    change,
    changeLabel:
      change > 0 ? `+${change} vs prior` : change < 0 ? `${change} vs prior` : "unchanged",
    lastUpdated: "Updated just now",
    confidence,
  };
}

export function buildScoreChangeExplanation(
  healthScore: HealthScore,
  explanations: ScoreImpactExplanation[],
  findings: Finding[],
  previousHealthScore?: HealthScore,
): ScoreChangeExplanation {
  const previousScore = previousHealthScore?.score ?? BASELINE_DIMENSION_SCORE;
  const drivers = explanations
    .filter((e) => e.impacts.length > 0)
    .map((e) => {
      const net = e.finalScore - e.baselineScore;
      const primary = e.impacts[0];
      return {
        dimension: DIMENSION_NAMES[e.dimensionId] ?? e.dimensionId,
        impact: net,
        reason: primary?.reason ?? "Score adjustment from findings",
        findingIds: e.impacts.map((i) => i.findingId),
        evidenceIds: [...new Set(e.impacts.flatMap((i) => i.evidenceIds))],
      };
    })
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const summary =
    findings.length === 0
      ? "Insufficient evidence to explain score movement; confidence reduced."
      : `Health at ${healthScore.score} based on ${findings.length} finding${findings.length === 1 ? "" : "s"} across scored dimensions.`;

  return {
    previousScore,
    currentScore: healthScore.score,
    change: healthScore.score - previousScore,
    period: "Current assessment",
    summary,
    drivers,
  };
}

export function computeHealthFromFindings(
  findings: Finding[],
  evidence: Evidence[],
  previousHealthScore?: HealthScore,
  dimensionProfiles?: HealthDimension[],
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
  );

  // Preserve UI metadata (owner, whyItMatters) from profiles when provided
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

  const healthScore = calculateOverallHealth(dimensions, evidence, previousHealthScore);
  healthScore.scoreExplanations = explanations;

  const scoreChange = buildScoreChangeExplanation(
    healthScore,
    explanations,
    findings,
    previousHealthScore,
  );

  return { dimensions, healthScore, scoreChange, explanations };
}
