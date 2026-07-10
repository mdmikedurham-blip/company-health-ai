import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/intelligence/rules";
import type {
  BriefPreviousSlice,
  CausalAnalysis,
  CausalDriver,
} from "./brief-types";
import {
  computeWeightedScore,
  splitPrimarySecondary,
} from "./driver-ranking";
import {
  buildDriverReason,
  deriveBusinessMateriality,
  resolveDriverTitle,
} from "./materiality";
import { computeScoreDelta } from "./score-delta";

const CONFLICT_MATERIALITY = 0.35;

export interface CausalAnalyzerInput {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  previous?: BriefPreviousSlice;
}

/**
 * Link score movement to findings, evidence, risks, recommendations, and timeline.
 * Deterministic — same inputs always yield the same CausalAnalysis.
 */
export function analyzeCausalDrivers(
  input: CausalAnalyzerInput,
): CausalAnalysis {
  const scoreDelta = computeScoreDelta({
    healthScore: input.healthScore,
    dimensions: input.dimensions,
    previous: input.previous,
  });

  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]));
  const riskByFinding = indexRisksByFinding(input.risks);
  const recByRisk = new Map(
    input.recommendations.map((r) => {
      const riskId = r.riskIds[0];
      return [riskId, r] as const;
    }),
  );

  const drivers: CausalDriver[] = input.findings
    .filter((f) => f.scoreImpact !== 0)
    .map((finding) => {
      const evidenceIds = [...finding.evidenceIds].sort();
      const evidenceCount = evidenceIds.length;
      const evidenceQuality = meanReliability(evidenceIds, evidenceById);
      const risk = riskByFinding.get(finding.id);
      const recommendation = risk
        ? recByRisk.get(risk.id)
        : input.recommendations.find((r) =>
            r.findingIds.includes(finding.id),
          );
      const timelineEventIds = input.timeline
        .filter(
          (t) =>
            t.dimensionId === finding.dimensionId ||
            (finding.evidenceIds.length > 0 &&
              t.title.toLowerCase().includes(
                (evidenceById.get(finding.evidenceIds[0]!)?.title ?? "")
                  .toLowerCase()
                  .slice(0, 24),
              )),
        )
        .map((t) => t.id)
        .sort();

      const impact = finding.scoreImpact;
      const confidence = finding.confidence;
      const businessMateriality = deriveBusinessMateriality({
        findingMateriality: finding.materiality,
        impact,
        evidenceCount,
        confidence,
        riskSeverity: risk?.severity,
      });
      const weightedScore = computeWeightedScore(
        impact,
        confidence,
        evidenceQuality,
        businessMateriality,
      );
      const dimension =
        finding.dimension ||
        DIMENSION_NAMES[finding.dimensionId] ||
        finding.dimensionId;
      const title = resolveDriverTitle({
        finding,
        evidenceTitle: evidenceById.get(evidenceIds[0] ?? "")?.title,
        dimension,
      });
      const reason = buildDriverReason({
        finding,
        risk,
        direction: finding.direction,
        dimension,
        impact,
      });

      return {
        id: `driver-${finding.id}`,
        title,
        dimensionId: finding.dimensionId,
        dimension,
        direction: finding.direction,
        healthImpact: impact,
        impact,
        confidence,
        evidenceCount,
        evidenceQuality,
        businessMateriality,
        reason,
        weightedScore,
        statement: buildDriverStatement(finding, evidenceIds, evidenceById),
        findingId: finding.id,
        evidenceIds,
        riskId: risk?.id,
        recommendationId: recommendation?.id,
        timelineEventIds,
      } satisfies CausalDriver;
    });

  // Dimension-level residual when score moved but no finding impacts
  if (
    drivers.length === 0 &&
    scoreDelta.change !== 0 &&
    input.evidence.length > 0
  ) {
    for (const dim of scoreDelta.byDimension.filter((d) => d.change !== 0)) {
      const dimEvidence = input.evidence
        .filter((e) => e.dimensionIds.includes(dim.dimensionId))
        .map((e) => e.id)
        .sort();
      const evidenceCount = dimEvidence.length;
      const evidenceQuality = meanReliability(dimEvidence, evidenceById);
      const confidence = input.healthScore.confidence;
      const businessMateriality = deriveBusinessMateriality({
        findingMateriality: Math.min(10, Math.abs(dim.change)),
        impact: dim.change,
        evidenceCount,
        confidence,
      });
      const reason = buildDriverReason({
        direction: dim.change > 0 ? "positive" : "negative",
        dimension: dim.dimension,
        impact: dim.change,
      });
      drivers.push({
        id: `driver-dim-${dim.dimensionId}`,
        title: resolveDriverTitle({
          evidenceTitle: evidenceById.get(dimEvidence[0] ?? "")?.title,
          dimension: dim.dimension,
        }),
        dimensionId: dim.dimensionId,
        dimension: dim.dimension,
        direction: dim.change > 0 ? "positive" : "negative",
        healthImpact: dim.change,
        impact: dim.change,
        confidence,
        evidenceCount,
        evidenceQuality,
        businessMateriality,
        reason,
        weightedScore: computeWeightedScore(
          dim.change,
          confidence,
          evidenceQuality,
          businessMateriality,
        ),
        statement:
          dimEvidence.length > 0
            ? `${dim.dimension} score ${formatSigned(dim.change)} from evidence ${dimEvidence.join(", ")}.`
            : `${dim.dimension} score ${formatSigned(dim.change)}; no linked evidence.`,
        evidenceIds: dimEvidence,
        timelineEventIds: input.timeline
          .filter((t) => t.dimensionId === dim.dimensionId)
          .map((t) => t.id)
          .sort(),
      });
    }
  }

  const { primaryDrivers, secondaryDrivers } = splitPrimarySecondary(drivers);

  const insufficientEvidence =
    input.evidence.length === 0 ||
    (drivers.length === 0 && Math.abs(scoreDelta.change) === 0) ||
    (drivers.length > 0 &&
      drivers.every((d) => d.evidenceIds.length === 0));

  const conflictingEvidence = detectConflict(input.findings);

  const confidence = computeBriefConfidence({
    healthConfidence: input.healthScore.confidence,
    drivers,
    insufficientEvidence,
    conflictingEvidence,
  });

  return {
    scoreDelta,
    drivers,
    primaryDrivers,
    secondaryDrivers,
    confidence,
    insufficientEvidence,
    conflictingEvidence,
  };
}

function indexRisksByFinding(risks: Risk[]): Map<string, Risk> {
  const map = new Map<string, Risk>();
  for (const risk of risks) {
    for (const fid of risk.findingIds) {
      if (!map.has(fid)) map.set(fid, risk);
    }
  }
  return map;
}

function meanReliability(
  evidenceIds: string[],
  evidenceById: Map<string, Evidence>,
): number {
  if (evidenceIds.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const id of evidenceIds) {
    const ev = evidenceById.get(id);
    if (!ev) continue;
    sum += ev.reliability;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round(sum / count);
}

function buildDriverStatement(
  finding: Finding,
  evidenceIds: string[],
  evidenceById: Map<string, Evidence>,
): string {
  const cite =
    evidenceIds.length > 0
      ? ` Evidence: ${evidenceIds.join(", ")}.`
      : " No supporting evidence IDs.";
  const titles = evidenceIds
    .map((id) => evidenceById.get(id)?.title)
    .filter((t): t is string => Boolean(t));
  const evidenceBit =
    titles.length > 0 ? ` Linked sources: ${titles.join("; ")}.` : "";
  return `${finding.title}: ${finding.description}${evidenceBit}${cite}`;
}

function detectConflict(findings: Finding[]): boolean {
  const byDim = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byDim.get(f.dimensionId) ?? [];
    list.push(f);
    byDim.set(f.dimensionId, list);
  }
  for (const list of byDim.values()) {
    const positives = list.filter(
      (f) => f.direction === "positive" && f.materiality >= CONFLICT_MATERIALITY,
    );
    const negatives = list.filter(
      (f) => f.direction === "negative" && f.materiality >= CONFLICT_MATERIALITY,
    );
    if (positives.length > 0 && negatives.length > 0) return true;
  }
  return false;
}

function computeBriefConfidence(params: {
  healthConfidence: number;
  drivers: CausalDriver[];
  insufficientEvidence: boolean;
  conflictingEvidence: boolean;
}): number {
  if (params.insufficientEvidence) {
    return Math.min(params.healthConfidence, 35);
  }
  let conf = params.healthConfidence;
  if (params.drivers.length > 0) {
    const avg =
      params.drivers.reduce((s, d) => s + d.confidence, 0) /
      params.drivers.length;
    conf = Math.round((conf + avg) / 2);
  }
  if (params.conflictingEvidence) {
    conf = Math.max(0, conf - 15);
  }
  return Math.max(0, Math.min(100, conf));
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
