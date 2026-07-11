/**
 * Application data layer — single read API for all pages.
 *
 * Canonical pipeline:
 *   Connectors → Evidence → application analysis → CompanyHealthSnapshot → UI
 *
 * Multi-company scale: call getCompanyHealthSnapshot(companyId) / build for
 * additional tenants. Pages never touch connectors or engine internals.
 */
import {
  companyBriefSeed,
  companyDNA as dnaProfile,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import { acmeConnectors } from "@/lib/connectors";
import {
  buildCompanyHealthSnapshot,
  buildCompanyHealthSnapshotFromSyncAdapters,
  buildEvidenceGraph,
  type PlatformInput,
} from "@/lib/application";
import {
  getDashboardMetrics,
  getDimension,
  getEvidence,
  getFinding,
  getInsight,
  getNextBestActions,
  getRisk,
  getTopRisks,
  toDimensionSummary,
  toRiskCardView,
  type CompanyHealthSnapshot,
  type Evidence,
} from "@/lib/domain";
import { DEFAULT_AS_OF } from "@/lib/intelligence";
import type { EvidenceRecordView } from "@/lib/types";

const platformConfigs = new Map<string, PlatformInput>([
  [
    companyProfile.id,
    {
      company: companyProfile,
      connectors: acmeConnectors,
      lastFullScan: "Today, 5:00 AM",
      dimensionProfiles,
      previousHealthScore,
      dna: dnaProfile,
      reports: companyReports,
      timelineSeed: companyTimelineSeed,
      briefSeed: companyBriefSeed,
      asOf: DEFAULT_AS_OF,
    },
  ],
]);

const snapshotCache = new Map<string, CompanyHealthSnapshot>();

function loadSnapshotSync(companyId: string): CompanyHealthSnapshot {
  const cached = snapshotCache.get(companyId);
  if (cached) return cached;

  const config = platformConfigs.get(companyId);
  if (!config) {
    throw new Error(`Unknown companyId: ${companyId}`);
  }

  const snapshot = buildCompanyHealthSnapshotFromSyncAdapters(config);
  snapshotCache.set(companyId, snapshot);
  return snapshot;
}

/** Register additional company platform configs (scale path). */
export function registerCompanyPlatform(input: PlatformInput): void {
  platformConfigs.set(input.company.id, input);
  snapshotCache.delete(input.company.id);
}

/** Company IDs currently registered for snapshot assembly. */
export function listRegisteredCompanyIds(): string[] {
  return [...platformConfigs.keys()];
}

/** Drop a cached snapshot so the next read rebuilds from connectors. */
export function invalidateCompanySnapshot(companyId: string): void {
  snapshotCache.delete(companyId);
}

/** Sync read for registered companies (mock SyncConnectorAdapters only). */
export function getCompanyHealthSnapshot(companyId: string): CompanyHealthSnapshot {
  return loadSnapshotSync(companyId);
}

/**
 * Canonical async rebuild for any ConnectorAdapter set.
 * Prefer this for production / request-time paths.
 */
export async function buildCompanyHealthSnapshotFor(
  companyId: string,
): Promise<CompanyHealthSnapshot> {
  const config = platformConfigs.get(companyId);
  if (!config) {
    throw new Error(`Unknown companyId: ${companyId}`);
  }
  const snapshot = await buildCompanyHealthSnapshot(config);
  snapshotCache.set(companyId, snapshot);
  return snapshot;
}

/** Canonical Acme snapshot used by all current pages. */
export const companySnapshot = getCompanyHealthSnapshot(companyProfile.id);

// ─── Entity accessors ────────────────────────────────────────────────────────

export const getDimensionById = (id: string) => getDimension(companySnapshot, id);
export const getRiskById = (id: string) => getRisk(companySnapshot, id);
export const getEvidenceById = (id: string) => getEvidence(companySnapshot, id);
export const getFindingById = (id: string) => getFinding(companySnapshot, id);
export const getInsightById = (id: string) => getInsight(companySnapshot, id);

// ─── Snapshot slices (domain entities) ───────────────────────────────────────

export const company = companySnapshot.company;
export const healthScore = companySnapshot.healthScore;
export const dimensions = companySnapshot.dimensions;
export const evidence = companySnapshot.evidence;
export const findings = companySnapshot.findings;
export const insights = companySnapshot.insights;
export const risks = companySnapshot.risks;
export const recommendations = companySnapshot.recommendations;
export const timelineEvents = companySnapshot.timeline;
export const companyDNA = companySnapshot.dna;
export const reports = companySnapshot.reports;
export const scoreChangeExplanation = companySnapshot.scoreChange;
export const executiveBrief = companySnapshot.executiveBrief;
export const evidenceCatalog = companySnapshot.evidenceCatalog;

// ─── Derived views ───────────────────────────────────────────────────────────

export const dimensionSummaries = companySnapshot.dimensions.map(toDimensionSummary);
export const healthDimensions = dimensionSummaries;
export const topRisks = getTopRisks(companySnapshot).map(toRiskCardView);
export const nextBestActions = getNextBestActions(companySnapshot);
export const dashboardMetrics = getDashboardMetrics(companySnapshot);

export const evidenceRecords: EvidenceRecordView[] = companySnapshot.evidence.map(
  toEvidenceRecordView,
);

function toEvidenceRecordView(item: Evidence): EvidenceRecordView {
  const linkedRisks = item.linkedRiskIds
    .map((riskId) => getRisk(companySnapshot, riskId)?.title)
    .filter((title): title is string => title !== undefined);

  const linkedFindings = companySnapshot.findings.filter((f) =>
    f.evidenceIds.includes(item.id),
  );
  const linkedRecs = companySnapshot.recommendations.filter(
    (rec) =>
      rec.evidenceIds.includes(item.id) ||
      rec.findingIds.some((fid) =>
        linkedFindings.some((f) => f.id === fid),
      ),
  );

  return {
    id: item.id,
    sourceSystem: item.sourceSystem,
    documentName: item.title,
    documentType: item.sourceType || "document",
    confidence: item.reliability,
    dimensions: [item.dimension].filter(Boolean),
    dimensionIds: [item.dimensionId, ...item.dimensionIds].filter(Boolean),
    aiSummary: item.contentSummary?.slice(0, 180) || "Evidence record",
    rawExtract: item.contentSummary || "",
    findingsCreated: linkedFindings.map((f) => f.title),
    risksCreated: linkedRisks,
    recommendationsCreated: linkedRecs.map((r) => r.title),
    processingDate: item.collectedAt,
    linkedFindingIds: linkedFindings.map((f) => f.id),
    linkedRiskIds: item.linkedRiskIds,
    linkedRecommendationIds: linkedRecs.map((r) => r.id),
    linkedDimensionIds: [item.dimensionId],
  };
}

const evidenceGraph = buildEvidenceGraph(companySnapshot);
export const evidenceGraphNodes = evidenceGraph.nodes;
export const evidenceGraphEdges = evidenceGraph.edges;

export {
  getDimensionIdByName,
  resolveEvidenceLabels,
} from "@/lib/domain";
