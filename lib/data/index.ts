/**
 * Application data layer — single read API for all pages.
 *
 * Full pipeline: Connectors → Insight Engine → CompanyHealthSnapshot.
 * Pages import from here; they never touch connector or engine internals.
 */
import { acmePlatformInput } from "@/lib/mock";
import { buildCompanyHealthSnapshot, buildEvidenceGraph } from "@/lib/connectors";
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
  type HealthDimension,
  type Risk,
} from "@/lib/domain";
import type { EvidenceRecordView } from "@/lib/types";

/** Canonical company health state — Connectors → Engine → Snapshot */
export const companySnapshot = buildCompanyHealthSnapshot(acmePlatformInput);

// ─── Entity accessors ────────────────────────────────────────────────────────

export const getDimensionById = (id: string) => getDimension(companySnapshot, id);
export const getRiskById = (id: string) => getRisk(companySnapshot, id);
export const getEvidenceById = (id: string) => getEvidence(companySnapshot, id);
export const getFindingById = (id: string) => getFinding(companySnapshot, id);
export const getInsightById = (id: string) => getInsight(companySnapshot, id);

// ─── Snapshot slices (domain entities) ───────────────────────────────────────

export const company = companySnapshot.company;
export const healthScore = companySnapshot.healthScore;
/** Full dimension entities (health page, explain drawer) */
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
/** Dashboard row projection of dimensions */
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

  const linkedInsights = item.findingIds
    .map((findingId) => getFinding(companySnapshot, findingId)?.title)
    .filter((title): title is string => title !== undefined);

  return {
    id: item.id,
    sourceSystem: item.sourceSystem,
    documentName: item.documentName,
    confidence: item.confidence,
    dimension: item.dimension,
    lastReviewed: item.lastReviewed,
    summary: item.summary,
    linkedRisks,
    linkedInsights,
  };
}

// ─── Evidence graph (derived from snapshot) ─────────────────────────────────

const evidenceGraph = buildEvidenceGraph(companySnapshot);
export const evidenceGraphNodes = evidenceGraph.nodes;
export const evidenceGraphEdges = evidenceGraph.edges;

// Re-export domain selectors for explain and other services
export {
  getDimensionIdByName,
  resolveEvidenceLabels,
} from "@/lib/domain";
