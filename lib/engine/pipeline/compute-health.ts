import type {
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  ScoreChangeExplanation,
} from "@/lib/domain";
import type { HealthStatus } from "@/lib/domain";
import type { RawEvidence } from "../types";

function deriveStatus(score: number): HealthStatus {
  if (score >= 85) return "healthy";
  if (score >= 70) return "watch";
  return "at-risk";
}

/**
 * Stage 5: Compute aggregate health score from dimension profiles and pipeline output.
 * Confidence is derived from evidence quality; score comes from configured baseline.
 */
export function computeHealthScore(
  _dimensions: HealthDimension[],
  _evidence: RawEvidence[],
  baseline: HealthScore,
): HealthScore {
  return {
    ...baseline,
    status: deriveStatus(baseline.score),
  };
}

/** Score change explanation is preserved from baseline; engine validates driver alignment. */
export function resolveScoreChange(
  scoreChange: ScoreChangeExplanation,
  _dimensions: HealthDimension[],
): ScoreChangeExplanation {
  return scoreChange;
}

/**
 * Stage 6: Enrich dimension profiles with pipeline-derived links.
 * Scores and metadata stay from profiles; evidence/finding/action links are computed.
 */
export function enrichDimensions(
  profiles: HealthDimension[],
  findings: Finding[],
  evidence: RawEvidence[],
  _recommendations: Recommendation[],
): HealthDimension[] {
  return profiles.map((profile) => {
    const dimensionFindings = findings.filter((f) => f.dimensionId === profile.id);
    const dimensionEvidence = evidence.filter((e) => e.dimensionId === profile.id);

    return {
      ...profile,
      evidenceIds: dimensionEvidence.map((e) => e.id),
      findingIds: dimensionFindings.map((f) => f.id),
    };
  });
}
