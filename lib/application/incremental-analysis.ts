/**
 * Incremental analysis — rescore only slices touched by changed documents.
 *
 * changed documents → affected findings → affected risks → affected dimensions
 *
 * Never wipe-and-replace the entire company. Overall health is recomposed from
 * carried-forward + rescored dimensions.
 */
import type {
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  EvidenceCatalog,
  HealthDimension,
  HealthScore,
  Report,
  TimelineEvent,
} from "@/lib/domain";
import {
  computeAffectedScope,
  mergeIncrementalIntelligence,
} from "@/lib/intelligence/affected-scope";
import { runInsightEngine } from "@/lib/intelligence";
import {
  buildScoreChangeExplanation,
  calculateOverallHealth,
} from "@/lib/intelligence/scoring-engine";
import {
  createServiceClient,
  getLatestHealthScore,
  isSupabaseConfigured,
  listEvidence,
  listFindings,
  listRisks,
  persistIncrementalEngineResult,
  type AppSupabaseClient,
} from "@/lib/supabase";
import type { BriefSeed } from "./build-brief";
import { buildExecutiveBrief } from "./build-brief";

export type IncrementalAnalyzeInput = {
  company: Company;
  changedEvidenceIds: string[];
  dimensionProfiles: HealthDimension[];
  previousHealthScore?: HealthScore;
  dna: CompanyDNA;
  reports: Report[];
  timelineSeed?: TimelineEvent[];
  briefSeed: BriefSeed;
  evidenceCatalog: EvidenceCatalog;
  asOf?: Date | string;
  client?: AppSupabaseClient;
};

/**
 * Load stored evidence, run the engine, merge only affected findings/risks/dimensions,
 * persist partial updates, and recompose overall health from all dimensions.
 */
export async function analyzeAndPersistIncremental(
  input: IncrementalAnalyzeInput,
): Promise<
  CompanyHealthSnapshot & {
    affected: {
      findingIds: string[];
      riskIds: string[];
      dimensionIds: string[];
    };
  }
> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (input.changedEvidenceIds.length === 0) {
    throw new Error("analyzeAndPersistIncremental requires changedEvidenceIds");
  }

  const client = input.client ?? createServiceClient();
  const allEvidence = await listEvidence(client, input.company.id);
  const priorFindings = await listFindings(client, input.company.id);
  const priorRisks = await listRisks(client, input.company.id);
  const priorHealth = await getLatestHealthScore(client, input.company.id);

  const changedIdSet = new Set(input.changedEvidenceIds);
  const changedEvidence = allEvidence.filter((e) => changedIdSet.has(e.id));

  const scope = computeAffectedScope(changedEvidence, []);

  // Expand scope for deletes / prior findings that referenced changed evidence
  for (const finding of priorFindings) {
    if (finding.evidenceIds.some((id) => changedIdSet.has(id))) {
      scope.findingIds = [...new Set([...scope.findingIds, finding.id])];
      scope.dimensionIds = [
        ...new Set([...scope.dimensionIds, finding.dimensionId]),
      ];
      const risk = priorRisks.find((r) => r.findingIds.includes(finding.id));
      if (risk) {
        scope.riskIds = [...new Set([...scope.riskIds, risk.id])];
      }
    }
  }

  const previousHealthScore =
    input.previousHealthScore ?? priorHealth?.healthScore;

  // Engine runs on full evidence for correct aggregation; we only persist
  // the affected finding/risk/dimension slices.
  const engine = runInsightEngine({
    companyId: input.company.id,
    evidence: allEvidence,
    previousHealthScore,
    dimensionProfiles: input.dimensionProfiles,
    asOf: input.asOf,
  });

  const priorDimensions =
    priorHealth?.dimensions?.length
      ? priorHealth.dimensions
      : input.dimensionProfiles;

  const merged = mergeIncrementalIntelligence({
    scope,
    priorFindings,
    priorRisks,
    priorDimensions,
    nextFindings: engine.findings,
    nextRisks: engine.risks,
    nextDimensions: engine.dimensions,
  });

  const asOf =
    typeof input.asOf === "string"
      ? new Date(input.asOf)
      : input.asOf instanceof Date
        ? input.asOf
        : new Date();

  // Recompose overall health from merged dimensions (unchanged dims carried forward)
  const healthScore = calculateOverallHealth(
    merged.dimensions,
    allEvidence,
    previousHealthScore,
    asOf,
  );
  healthScore.scoreExplanations = (engine.healthScore.scoreExplanations ?? []).filter(
    (e) => scope.dimensionIds.includes(e.dimensionId),
  );

  const scoreChange = buildScoreChangeExplanation(
    healthScore,
    healthScore.scoreExplanations ?? [],
    merged.findings,
    previousHealthScore,
  );

  const evidenceToPersist = engine.evidence.filter((e) =>
    changedIdSet.has(e.id),
  );

  await persistIncrementalEngineResult(client, {
    companyId: input.company.id,
    findingsUpsert: merged.findingsUpsert,
    findingsDelete: merged.findingsDelete,
    risksUpsert: merged.risksUpsert,
    risksDelete: merged.risksDelete,
    evidence: evidenceToPersist,
    healthScore,
    dimensions: merged.dimensions,
    scoreChange,
    asOf: asOf.toISOString(),
  });

  const dna = {
    ...input.dna,
    topRisks: merged.risks.slice(0, 3).map((r) => r.title),
    keyMetrics: [
      ...input.dna.keyMetrics.filter((m) => m.label !== "Health Score"),
      {
        label: "Health Score",
        value: String(healthScore.score),
        change: healthScore.changeLabel,
      },
    ],
  };

  const timeline = [...engine.timelineEvents, ...(input.timelineSeed ?? [])];
  const priorScore =
    input.previousHealthScore ?? priorHealth?.healthScore ?? undefined;

  const executiveBrief = buildExecutiveBrief({
    healthScore,
    dimensions: merged.dimensions,
    findings: merged.findings,
    risks: merged.risks,
    recommendations: engine.recommendations,
    evidence: engine.evidence,
    timeline,
    previous: priorScore
      ? {
          healthScore: {
            score: priorScore.score,
            confidence: priorScore.confidence,
          },
          findings: priorFindings.map((f) => ({
            id: f.id,
            dimensionId: f.dimensionId,
            scoreImpact: f.scoreImpact,
          })),
        }
      : undefined,
    seed: input.briefSeed,
    asOf,
  });

  return {
    company: input.company,
    healthScore,
    dimensions: merged.dimensions,
    evidence: engine.evidence,
    evidenceCatalog: input.evidenceCatalog,
    findings: merged.findings,
    insights: engine.insights,
    risks: merged.risks,
    recommendations: engine.recommendations,
    timeline,
    dna,
    reports: input.reports,
    scoreChange,
    executiveBrief,
    affected: {
      findingIds: scope.findingIds,
      riskIds: scope.riskIds,
      dimensionIds: scope.dimensionIds,
    },
  };
}

/** True when incremental sync produced work that needs rescoring. */
export function shouldRescoreIncremental(delta: {
  added: number;
  changed: number;
  deleted: number;
}): boolean {
  return delta.added + delta.changed + delta.deleted > 0;
}
