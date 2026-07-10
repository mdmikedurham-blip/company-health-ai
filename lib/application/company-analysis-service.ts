/**
 * Company analysis orchestration.
 *
 * Connectors sync + normalize → Evidence.
 * This layer runs the Insight Engine and assembles CompanyHealthSnapshot.
 * Connectors never import intelligence or know about scores/risks/UI.
 */

import type {
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  Evidence,
  EvidenceCatalog,
  HealthDimension,
  HealthScore,
  Report,
  TimelineEvent,
} from "@/lib/domain";
import type { ConnectorAdapter } from "@/lib/connectors/connector";
import { runConnectorPipeline } from "@/lib/connectors/ingest";
import {
  requireSyncAdapters,
  runConnectorPipelineSync,
} from "@/lib/connectors/ingest-sync";
import { runInsightEngine } from "@/lib/intelligence";
import {
  createServiceClient,
  isSupabaseConfigured,
  listEvidence,
  persistEngineResult,
  type AppSupabaseClient,
} from "@/lib/supabase";
import { buildExecutiveBrief, type BriefSeed } from "./build-brief";

export type { BriefSeed };

export interface PlatformInput {
  company: Company;
  connectors: ConnectorAdapter[];
  lastFullScan: string;
  dimensionProfiles: HealthDimension[];
  previousHealthScore?: HealthScore;
  dna: CompanyDNA;
  reports: Report[];
  timelineSeed?: TimelineEvent[];
  /** Board calendar seed — highlights/wins come from the engine. */
  briefSeed: BriefSeed;
  /** Assessment clock forwarded to the Insight Engine (deterministic runs). */
  asOf?: Date | string;
}

function assembleSnapshot(
  input: PlatformInput,
  evidence: Evidence[],
  evidenceCatalog: EvidenceCatalog,
): CompanyHealthSnapshot {
  const engine = runInsightEngine({
    companyId: input.company.id,
    evidence,
    previousHealthScore: input.previousHealthScore,
    dimensionProfiles: input.dimensionProfiles,
    asOf: input.asOf,
  });

  const dna = {
    ...input.dna,
    topRisks: engine.risks.slice(0, 3).map((r) => r.title),
    keyMetrics: [
      ...input.dna.keyMetrics.filter((m) => m.label !== "Health Score"),
      {
        label: "Health Score",
        value: String(engine.healthScore.score),
        change: engine.healthScore.changeLabel,
      },
    ],
  };

  const executiveBrief = buildExecutiveBrief({
    healthScore: engine.healthScore,
    scoreChange: engine.scoreChange,
    findings: engine.findings,
    insights: engine.insights,
    risks: engine.risks,
    seed: input.briefSeed,
    asOf: input.asOf,
  });

  return {
    company: input.company,
    healthScore: engine.healthScore,
    dimensions: engine.dimensions,
    evidence: engine.evidence,
    evidenceCatalog,
    findings: engine.findings,
    insights: engine.insights,
    risks: engine.risks,
    recommendations: engine.recommendations,
    timeline: [...engine.timelineEvents, ...(input.timelineSeed ?? [])],
    dna,
    reports: input.reports,
    scoreChange: engine.scoreChange,
    executiveBrief,
  };
}

/**
 * Canonical entry — connector sync/normalize, then Insight Engine → snapshot.
 */
export async function buildCompanyHealthSnapshot(
  input: PlatformInput,
): Promise<CompanyHealthSnapshot> {
  const { evidence, evidenceCatalog } = await runConnectorPipeline({
    connectors: input.connectors,
    lastFullScan: input.lastFullScan,
  });
  return assembleSnapshot(input, evidence, evidenceCatalog);
}

/**
 * @internal Used only by lib/data module-init for mock SyncConnectorAdapters.
 * Prefer buildCompanyHealthSnapshot() for production / request-time paths.
 */
export function buildCompanyHealthSnapshotFromSyncAdapters(
  input: PlatformInput,
): CompanyHealthSnapshot {
  const syncAdapters = requireSyncAdapters(input.connectors);
  const { evidence, evidenceCatalog } = runConnectorPipelineSync({
    connectors: syncAdapters,
    lastFullScan: input.lastFullScan,
  });
  return assembleSnapshot(input, evidence, evidenceCatalog);
}

/**
 * Load persisted evidence for a company, run the Insight Engine, return snapshot.
 * Does not re-sync connectors — use after documents/evidence are already stored.
 */
export async function analyzeCompanyFromStoredEvidence(input: {
  company: Company;
  lastFullScan: string;
  dimensionProfiles: HealthDimension[];
  previousHealthScore?: HealthScore;
  dna: CompanyDNA;
  reports: Report[];
  timelineSeed?: TimelineEvent[];
  briefSeed: BriefSeed;
  asOf?: Date | string;
  evidenceCatalog: EvidenceCatalog;
  client?: AppSupabaseClient;
}): Promise<CompanyHealthSnapshot> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const client = input.client ?? createServiceClient();
  const evidence = await listEvidence(client, input.company.id);
  return assembleSnapshot(
    {
      company: input.company,
      connectors: [],
      lastFullScan: input.lastFullScan,
      dimensionProfiles: input.dimensionProfiles,
      previousHealthScore: input.previousHealthScore,
      dna: input.dna,
      reports: input.reports,
      timelineSeed: input.timelineSeed,
      briefSeed: input.briefSeed,
      asOf: input.asOf,
    },
    evidence,
    input.evidenceCatalog,
  );
}

/**
 * Full analyze path: connector sync → engine → persist intelligence tables.
 */
export async function analyzeAndPersistCompany(
  input: PlatformInput,
  client?: AppSupabaseClient,
): Promise<CompanyHealthSnapshot> {
  const snapshot = await buildCompanyHealthSnapshot(input);

  if (isSupabaseConfigured()) {
    const db = client ?? createServiceClient();
    await persistEngineResult(db, {
      companyId: input.company.id,
      evidence: snapshot.evidence,
      findings: snapshot.findings,
      risks: snapshot.risks,
      recommendations: snapshot.recommendations,
      healthScore: snapshot.healthScore,
      dimensions: snapshot.dimensions,
      scoreChange: snapshot.scoreChange,
      timelineEvents: snapshot.timeline,
      asOf:
        typeof input.asOf === "string"
          ? input.asOf
          : input.asOf?.toISOString(),
    });
  }

  return snapshot;
}
