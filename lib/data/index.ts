/**
 * Application data layer — single read API for all pages.
 *
 * Pipeline: mock evidence → runInsightEngine() → CompanyHealthSnapshot.
 * Pages import from here; they never duplicate derived scores or risks.
 */
import {
  companyDNA as dnaProfile,
  companyExecutiveBrief,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import { mockEvidence, mockEvidenceCatalogMeta } from "@/lib/data/mock-evidence";
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
  type EvidenceCatalog,
} from "@/lib/domain";
import { runInsightEngine } from "@/lib/intelligence";
import type { EvidenceGraphEdge, EvidenceGraphNode, EvidenceRecordView } from "@/lib/types";

function buildEvidenceCatalog(evidence: Evidence[]): EvidenceCatalog {
  const systems = new Set(evidence.map((e) => e.sourceSystem));
  return {
    totalDocuments: mockEvidenceCatalogMeta.connectors.reduce(
      (sum, c) => sum + c.documentsAnalyzed,
      0,
    ),
    systemsConnected: systems.size,
    lastFullScan: mockEvidenceCatalogMeta.lastFullScan,
    connectors: mockEvidenceCatalogMeta.connectors,
  };
}

function buildEvidenceGraph(snapshot: CompanyHealthSnapshot): {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
} {
  const DOC_X = 80;
  const DIM_X = 280;
  const OUTCOME_X = 480;
  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];
  const dimensionY = new Map<string, number>();

  snapshot.evidence.forEach((doc, i) => {
    const label = (doc.title || doc.documentName).split(" ")[0] ?? doc.title;
    nodes.push({
      id: doc.id,
      label,
      type: "document",
      x: DOC_X,
      y: 60 + i * 70,
    });

    if (!dimensionY.has(doc.dimensionId)) {
      dimensionY.set(doc.dimensionId, 60 + dimensionY.size * 80);
    }
    edges.push({ from: doc.id, to: doc.dimensionId });
  });

  for (const [dimId, y] of dimensionY) {
    const dim = snapshot.dimensions.find((d) => d.id === dimId);
    nodes.push({
      id: dimId,
      label: dim?.name ?? dimId,
      type: "dimension",
      x: DIM_X,
      y,
    });
  }

  let outcomeY = 50;
  for (const risk of snapshot.risks) {
    nodes.push({
      id: risk.id,
      label: risk.title.split(" ")[0] ?? risk.title,
      type: "risk",
      x: OUTCOME_X,
      y: outcomeY,
    });
    edges.push({ from: risk.dimensionId, to: risk.id });
    outcomeY += 80;
  }

  for (const insight of snapshot.insights) {
    nodes.push({
      id: insight.id,
      label: (insight.title || insight.statement).split(" ")[0] ?? insight.statement,
      type: "insight",
      x: OUTCOME_X,
      y: outcomeY,
    });
    edges.push({ from: insight.dimensionId, to: insight.id });
    outcomeY += 80;
  }

  return { nodes, edges };
}

function assembleSnapshot(): CompanyHealthSnapshot {
  const engine = runInsightEngine({
    companyId: companyProfile.id,
    evidence: mockEvidence,
    previousHealthScore,
    dimensionProfiles,
  });

  // Prefer engine timeline; keep a short historical seed for context.
  const timeline = [...engine.timelineEvents, ...companyTimelineSeed];

  // DNA top risks stay in sync with engine output
  const dna = {
    ...dnaProfile,
    topRisks: engine.risks.slice(0, 3).map((r) => r.title),
    keyMetrics: [
      ...dnaProfile.keyMetrics.filter((m) => m.label !== "Health Score"),
      {
        label: "Health Score",
        value: String(engine.healthScore.score),
        change: engine.healthScore.changeLabel,
      },
    ],
  };

  return {
    company: companyProfile,
    healthScore: engine.healthScore,
    dimensions: engine.dimensions,
    evidence: engine.evidence,
    evidenceCatalog: buildEvidenceCatalog(engine.evidence),
    findings: engine.findings,
    insights: engine.insights,
    risks: engine.risks,
    recommendations: engine.recommendations,
    timeline,
    dna,
    reports: companyReports,
    scoreChange: engine.scoreChange,
    executiveBrief: {
      ...companyExecutiveBrief,
      summary: engine.scoreChange.summary,
    },
  };
}

/** Canonical company health state — Insight Engine output */
export const companySnapshot = assembleSnapshot();

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

  const linkedInsights = companySnapshot.insights
    .filter((insight) => insight.evidenceIds.includes(item.id))
    .map((insight) => insight.title || insight.statement);

  return {
    id: item.id,
    sourceSystem: item.sourceSystem,
    documentName: item.title || item.documentName,
    confidence: item.reliability ?? item.confidence,
    dimension: item.dimension,
    lastReviewed: item.collectedAt || item.lastReviewed,
    summary: item.contentSummary || item.summary,
    linkedRisks,
    linkedInsights,
  };
}

const evidenceGraph = buildEvidenceGraph(companySnapshot);
export const evidenceGraphNodes = evidenceGraph.nodes;
export const evidenceGraphEdges = evidenceGraph.edges;

export {
  getDimensionIdByName,
  resolveEvidenceLabels,
} from "@/lib/domain";
