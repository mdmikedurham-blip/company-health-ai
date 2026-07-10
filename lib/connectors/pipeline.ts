/**
 * Canonical platform pipeline:
 *   ConnectorAdapter.sync() → normalize() → Evidence
 *   → Insight Engine → CompanyHealthSnapshot
 *
 * Public API: buildCompanyHealthSnapshot (async only).
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
import { runInsightEngine } from "@/lib/intelligence";
import { buildExecutiveBrief, type BriefSeed } from "./build-brief";
import { buildEvidenceGraph } from "./graph";
import { runConnectorPipeline } from "./ingest";
import {
  requireSyncAdapters,
  runConnectorPipelineSync,
} from "./ingest-sync";
import type { ConnectorAdapter } from "./connector";

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
 * Canonical entry — await sync() + normalize() on every adapter, then run the engine.
 * Use this for production and for per-company request paths.
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
 * Prefer buildCompanyHealthSnapshot() for all application and production call sites.
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

export { buildEvidenceGraph };
