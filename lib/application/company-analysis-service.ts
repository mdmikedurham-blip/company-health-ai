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
import { syncGoogleDriveForCompany } from "@/lib/connectors/google-drive/sync";
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
import {
  analyzeAndPersistIncremental,
  shouldRescoreIncremental,
} from "./incremental-analysis";

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
  /** Board calendar seed — implications are derived from risks/drivers. */
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

  const timeline = [...engine.timelineEvents, ...(input.timelineSeed ?? [])];

  const executiveBrief = buildExecutiveBrief({
    healthScore: engine.healthScore,
    dimensions: engine.dimensions,
    findings: engine.findings,
    risks: engine.risks,
    recommendations: engine.recommendations,
    evidence: engine.evidence,
    timeline,
    previous: input.previousHealthScore
      ? {
          healthScore: {
            score: input.previousHealthScore.score,
            confidence: input.previousHealthScore.confidence,
          },
        }
      : undefined,
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
    timeline,
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
 *
 * Pipeline: Evidence (DB) → Insight Engine → CompanyHealthSnapshot
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
 * Evidence Store → Insight Engine → persist.
 * Reads evidence from the database, runs the engine, writes findings/risks/scores.
 */
export async function analyzeAndPersistFromStoredEvidence(
  input: Parameters<typeof analyzeCompanyFromStoredEvidence>[0],
): Promise<CompanyHealthSnapshot> {
  const snapshot = await analyzeCompanyFromStoredEvidence(input);

  if (isSupabaseConfigured()) {
    const db = input.client ?? createServiceClient();
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

/**
 * Production Evidence Store pipeline for Google Drive (incremental):
 * Sync delta → store Evidence → rescore only affected findings/risks/dimensions.
 */
export async function syncStoreAndAnalyzeCompany(
  input: PlatformInput & {
    client?: AppSupabaseClient;
    /** Override company id used for Drive sync (defaults to input.company.id). */
    syncCompanyId?: string;
    mode?: "full" | "incremental";
  },
): Promise<{
  sync: Awaited<ReturnType<typeof syncGoogleDriveForCompany>>;
  snapshot: CompanyHealthSnapshot | null;
  affected?: {
    findingIds: string[];
    riskIds: string[];
    dimensionIds: string[];
  };
}> {
  const companyId = input.syncCompanyId ?? input.company.id;
  const sync = await syncGoogleDriveForCompany(companyId, input.client, {
    mode: input.mode ?? "incremental",
  });

  if (sync.status !== "succeeded" || !shouldRescoreIncremental(sync.delta)) {
    return { sync, snapshot: null };
  }

  const evidenceCatalog: EvidenceCatalog = {
    totalDocuments: sync.documentsAnalyzed,
    systemsConnected: 1,
    lastFullScan: new Date().toISOString(),
    connectors: [
      {
        id: "google-drive",
        name: "Google Drive",
        system: "Google Drive",
        documentsAnalyzed: sync.documentsAnalyzed,
        lastSynced: new Date().toISOString(),
      },
    ],
  };

  const snapshot = await analyzeAndPersistIncremental({
    company: input.company,
    changedEvidenceIds: sync.changedEvidenceIds,
    dimensionProfiles: input.dimensionProfiles,
    previousHealthScore: input.previousHealthScore,
    dna: input.dna,
    reports: input.reports,
    timelineSeed: input.timelineSeed,
    briefSeed: input.briefSeed,
    asOf: input.asOf,
    evidenceCatalog,
    client: input.client,
  });

  return {
    sync,
    snapshot,
    affected: snapshot.affected,
  };
}
