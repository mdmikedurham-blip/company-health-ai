/**
 * Diff two published assessment snapshot packs.
 */

import type {
  AssessmentSnapshotDiff,
  AssessmentSnapshotPack,
} from "@/lib/domain/assessment-snapshot";

function idsOf<T extends { id: string }>(items: T[]): Set<string> {
  return new Set(items.map((i) => i.id));
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((id) => !b.has(id));
}

export function diffAssessmentSnapshots(input: {
  current: AssessmentSnapshotPack;
  previous: AssessmentSnapshotPack | null;
}): AssessmentSnapshotDiff {
  const { current, previous } = input;
  if (!previous) {
    return {
      currentSnapshotId: current.snapshotId,
      previousSnapshotId: null,
      newFindingIds: current.findings.map((f) => f.id),
      resolvedFindingIds: [],
      newRiskIds: current.risks.map((r) => r.id),
      resolvedRiskIds: [],
      recommendationAddedIds: current.recommendations.map((r) => r.id),
      recommendationRemovedIds: [],
      scoreMovement: {
        previous: null,
        current: current.healthScore.scoreAvailable
          ? current.healthScore.score
          : null,
        delta: null,
      },
      coverageMovement: {
        previous: null,
        current: current.coverageRatio,
        delta: null,
      },
      confidenceMovement: {
        previous: null,
        current: current.confidence,
        delta: null,
      },
      newEvidenceIds: current.evidenceIds,
      removedEvidenceIds: [],
    };
  }

  const curFindings = idsOf(current.findings);
  const prevFindings = idsOf(previous.findings);
  const curRisks = idsOf(current.risks);
  const prevRisks = idsOf(previous.risks);
  const curRecs = idsOf(current.recommendations);
  const prevRecs = idsOf(previous.recommendations);
  const curEvidence = new Set(current.evidenceIds);
  const prevEvidence = new Set(previous.evidenceIds);

  const prevScore = previous.healthScore.scoreAvailable
    ? previous.healthScore.score
    : null;
  const curScore = current.healthScore.scoreAvailable
    ? current.healthScore.score
    : null;

  return {
    currentSnapshotId: current.snapshotId,
    previousSnapshotId: previous.snapshotId,
    newFindingIds: setDiff(curFindings, prevFindings),
    resolvedFindingIds: setDiff(prevFindings, curFindings),
    newRiskIds: setDiff(curRisks, prevRisks),
    resolvedRiskIds: setDiff(prevRisks, curRisks),
    recommendationAddedIds: setDiff(curRecs, prevRecs),
    recommendationRemovedIds: setDiff(prevRecs, curRecs),
    scoreMovement: {
      previous: prevScore,
      current: curScore,
      delta:
        prevScore != null && curScore != null ? curScore - prevScore : null,
    },
    coverageMovement: {
      previous: previous.coverageRatio,
      current: current.coverageRatio,
      delta: Math.round((current.coverageRatio - previous.coverageRatio) * 1000) / 1000,
    },
    confidenceMovement: {
      previous: previous.confidence,
      current: current.confidence,
      delta: Math.round((current.confidence - previous.confidence) * 100) / 100,
    },
    newEvidenceIds: setDiff(curEvidence, prevEvidence),
    removedEvidenceIds: setDiff(prevEvidence, curEvidence),
  };
}
