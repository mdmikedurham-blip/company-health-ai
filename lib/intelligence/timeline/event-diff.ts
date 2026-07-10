import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
} from "@/lib/domain";
import type {
  AnalysisDiff,
  DimensionScoreDiff,
  DocumentDiff,
  FindingDiff,
  RiskDiff,
  TimelineDocument,
  TimelinePreviousSlice,
} from "./timeline-types";

function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function findingChanged(
  prior: TimelinePreviousSlice["findings"][number],
  next: Finding,
): boolean {
  return (
    prior.scoreImpact !== next.scoreImpact ||
    prior.materiality !== next.materiality ||
    prior.confidence !== next.confidence ||
    prior.title !== next.title ||
    prior.description !== next.description ||
    prior.direction !== next.direction ||
    sortedUnique(prior.evidenceIds).join(",") !==
      sortedUnique(next.evidenceIds).join(",")
  );
}

function riskChanged(
  prior: TimelinePreviousSlice["risks"][number],
  next: Risk,
): boolean {
  return (
    prior.severity !== next.severity ||
    prior.status !== next.status ||
    prior.confidence !== next.confidence ||
    prior.summary !== next.summary ||
    prior.title !== next.title ||
    prior.estimatedScoreImpact !== next.estimatedScoreImpact ||
    sortedUnique(prior.evidenceIds).join(",") !==
      sortedUnique(next.evidenceIds).join(",") ||
    sortedUnique(prior.findingIds).join(",") !==
      sortedUnique(next.findingIds).join(",")
  );
}

function documentChanged(
  prior: TimelineDocument,
  next: TimelineDocument,
): boolean {
  return (
    (prior.contentHash ?? null) !== (next.contentHash ?? null) ||
    (prior.modifiedAt ?? null) !== (next.modifiedAt ?? null) ||
    prior.title !== next.title
  );
}

export function diffFindings(
  prior: TimelinePreviousSlice["findings"],
  current: Finding[],
): FindingDiff {
  const priorById = new Map(prior.map((f) => [f.id, f]));
  const currentIds = new Set(current.map((f) => f.id));
  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const finding of current) {
    const prev = priorById.get(finding.id);
    if (!prev) {
      created.push(finding.id);
    } else if (findingChanged(prev, finding)) {
      updated.push(finding.id);
    } else {
      unchanged.push(finding.id);
    }
  }

  const removed = prior
    .map((f) => f.id)
    .filter((id) => !currentIds.has(id))
    .sort();

  return {
    created: created.sort(),
    updated: updated.sort(),
    unchanged: unchanged.sort(),
    removed,
  };
}

export function diffRisks(
  prior: TimelinePreviousSlice["risks"],
  current: Risk[],
): RiskDiff {
  const priorById = new Map(prior.map((r) => [r.id, r]));
  const currentIds = new Set(current.map((r) => r.id));
  const created: string[] = [];
  const updated: string[] = [];
  const resolved: string[] = [];
  const unchanged: string[] = [];

  for (const risk of current) {
    const prev = priorById.get(risk.id);
    if (!prev) {
      if (risk.status === "resolved") {
        resolved.push(risk.id);
      } else {
        created.push(risk.id);
      }
      continue;
    }
    if (risk.status === "resolved" && prev.status !== "resolved") {
      resolved.push(risk.id);
    } else if (findingRiskUpdated(prev, risk)) {
      updated.push(risk.id);
    } else {
      unchanged.push(risk.id);
    }
  }

  // Prior open risks missing from current → resolved
  for (const prev of prior) {
    if (!currentIds.has(prev.id) && prev.status !== "resolved") {
      resolved.push(prev.id);
    }
  }

  return {
    created: created.sort(),
    updated: [...new Set(updated)].sort(),
    resolved: [...new Set(resolved)].sort(),
    unchanged: unchanged.sort(),
  };
}

function findingRiskUpdated(
  prior: TimelinePreviousSlice["risks"][number],
  next: Risk,
): boolean {
  if (next.status === "resolved" && prior.status !== "resolved") return false;
  return riskChanged(prior, next);
}

export function diffDocuments(
  prior: TimelineDocument[] | undefined,
  current: TimelineDocument[] | undefined,
): DocumentDiff {
  const priorList = prior ?? [];
  const currentList = current ?? [];
  const priorById = new Map(priorList.map((d) => [d.id, d]));
  const added: TimelineDocument[] = [];
  const updated: TimelineDocument[] = [];

  for (const doc of [...currentList].sort((a, b) => a.id.localeCompare(b.id))) {
    const prev = priorById.get(doc.id);
    if (!prev) added.push(doc);
    else if (documentChanged(prev, doc)) updated.push(doc);
  }

  return { added, updated };
}

export function diffEvidenceIds(
  priorIds: EvidenceId[] | undefined,
  current: Evidence[],
): string[] {
  const prior = new Set(priorIds ?? []);
  return current
    .map((e) => e.id)
    .filter((id) => !prior.has(id))
    .sort();
}

export function diffDimensions(
  prior: TimelinePreviousSlice["dimensions"] | undefined,
  current: HealthDimension[],
  findings: Finding[],
): DimensionScoreDiff[] {
  const priorById = new Map((prior ?? []).map((d) => [d.id, d.score]));
  const diffs: DimensionScoreDiff[] = [];

  for (const dim of [...current].sort((a, b) => a.id.localeCompare(b.id))) {
    const previousScore =
      priorById.get(dim.id) ??
      dim.score -
        (findings
          .filter((f) => f.dimensionId === dim.id)
          .reduce((sum, f) => sum + f.scoreImpact, 0) || 0);
    const change = dim.score - previousScore;
    if (change === 0 && priorById.has(dim.id)) continue;
    if (change === 0 && !priorById.has(dim.id)) continue;

    const dimFindings = findings.filter((f) => f.dimensionId === dim.id);
    diffs.push({
      dimensionId: dim.id,
      dimension: dim.name,
      previousScore,
      currentScore: dim.score,
      change,
      findingIds: dimFindings.map((f) => f.id).sort(),
      evidenceIds: sortedUnique(dimFindings.flatMap((f) => f.evidenceIds)),
    });
  }

  return diffs.filter((d) => d.change !== 0);
}

export function diffAnalysis(params: {
  previous?: TimelinePreviousSlice;
  findings: Finding[];
  risks: Risk[];
  evidence: Evidence[];
  dimensions: HealthDimension[];
  healthScore: HealthScore;
  recommendations: Recommendation[];
  documents?: TimelineDocument[];
}): AnalysisDiff {
  const previous = params.previous;
  const findings = diffFindings(previous?.findings ?? [], params.findings);
  const risks = diffRisks(previous?.risks ?? [], params.risks);
  const documents = diffDocuments(previous?.documents, params.documents);
  const evidenceCreated = diffEvidenceIds(
    previous?.evidenceIds,
    params.evidence,
  );

  // First run (no prior): treat all current evidence/findings/risks as created
  const isFirstRun = !previous;
  const evidenceCreatedFinal = isFirstRun
    ? params.evidence.map((e) => e.id).sort()
    : evidenceCreated;

  const findingsFinal: FindingDiff = isFirstRun
    ? {
        created: params.findings.map((f) => f.id).sort(),
        updated: [],
        unchanged: [],
        removed: [],
      }
    : findings;

  const risksFinal: RiskDiff = isFirstRun
    ? {
        created: params.risks
          .filter((r) => r.status !== "resolved")
          .map((r) => r.id)
          .sort(),
        updated: [],
        resolved: params.risks
          .filter((r) => r.status === "resolved")
          .map((r) => r.id)
          .sort(),
        unchanged: [],
      }
    : risks;

  const dimensions = diffDimensions(
    previous?.dimensions,
    params.dimensions,
    params.findings,
  );

  const priorScore = previous?.healthScore?.score;
  const overallScore =
    priorScore !== undefined && priorScore !== params.healthScore.score
      ? {
          previousScore: priorScore,
          currentScore: params.healthScore.score,
          change: params.healthScore.score - priorScore,
        }
      : priorScore === undefined && params.healthScore.change !== 0
        ? {
            previousScore:
              params.healthScore.score - params.healthScore.change,
            currentScore: params.healthScore.score,
            change: params.healthScore.change,
          }
        : undefined;

  const priorRecIds = new Set(
    (previous?.recommendations ?? []).map((r) => r.id),
  );
  const recommendationsCreated = params.recommendations
    .map((r) => r.id)
    .filter((id) => isFirstRun || !priorRecIds.has(id))
    .sort();

  return {
    findings: findingsFinal,
    risks: risksFinal,
    documents: isFirstRun
      ? {
          added: [...(params.documents ?? [])].sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
          updated: [],
        }
      : documents,
    evidenceCreated: evidenceCreatedFinal,
    dimensions,
    overallScore,
    recommendationsCreated,
  };
}

type EvidenceId = string;
