import { describe, expect, it } from "vitest";
import {
  buildEvidenceExplorerGraph,
  buildEvidenceExplorerRecords,
  collectHighlightIds,
} from "./evidence-explorer-model";
import { layoutEvidenceExplorerGraph } from "./evidence-graph-layout";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type { Finding, Recommendation, Risk } from "@/lib/domain";

function ev(id: string, title: string, type: string) {
  return createEvidence({
    id,
    sourceSystem: "Manual Upload",
    sourceType: type,
    title,
    contentSummary: "Revenue\t100\nCash Balance\t50",
    extractedFacts: {
      evidenceType: type,
      revenue: 100,
      cashBalance: 50,
      financialMetricKeys: ["revenue", "cashBalance"],
      recommendedFindingTitle: "Financial metrics available",
    },
    dimensionIds: ["dim-financial"],
    occurredAt: "2026-07-01",
    collectedAt: "2026-07-11T12:00:00.000Z",
    reliability: 88,
  });
}

const finding: Finding = {
  id: "finding-financial-metrics",
  title: "Financial metrics",
  description: "Metrics present",
  dimensionId: "dim-financial",
  dimension: "Financial",
  insightIds: [],
  evidenceIds: ["doc-1"],
  direction: "neutral",
  materiality: 5,
  confidence: 80,
  scoreImpact: 0,
  summary: "Metrics present",
  extractedAt: "2026-07-11",
  sourceSystem: "Manual Upload",
};

const risk: Risk = {
  id: "risk-runway",
  title: "Runway risk",
  summary: "Short runway",
  dimensionId: "dim-financial",
  dimension: "Financial",
  severity: "high",
  likelihood: 0.5,
  impact: 0.8,
  findingIds: ["finding-financial-metrics"],
  evidenceIds: ["doc-1"],
  confidence: 70,
  status: "open",
  estimatedScoreImpact: -8,
  whyItMatters: "Cash",
  recommendationId: "rec-1",
  recommendation: "Extend runway",
  primaryEvidenceLabel: "doc",
  explainPrompt: "why",
};

const rec: Recommendation = {
  id: "rec-1",
  title: "Extend runway",
  description: "Raise or cut burn",
  dimensionId: "dim-financial",
  dimension: "Financial",
  riskIds: ["risk-runway"],
  evidenceIds: ["doc-1"],
  priority: "high",
  effort: "medium",
  confidence: 75,
  estimatedScoreImprovement: 6,
  rationale: "Cash risk",
  nextSteps: ["Plan"],
  priorityScore: 10,
  findingIds: ["finding-financial-metrics"],
};

describe("evidence explorer graph", () => {
  it("connects document → facts → dimension → finding → risk → recommendation", () => {
    const evidence = [ev("doc-1", "financials.xlsx", "financial")];
    const { nodes, edges } = buildEvidenceExplorerGraph({
      evidence,
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      clusterThreshold: 100,
    });

    const kinds = new Set(nodes.map((n) => n.kind));
    expect(kinds.has("document")).toBe(true);
    expect(kinds.has("fact")).toBe(true);
    expect(kinds.has("dimension")).toBe(true);
    expect(kinds.has("finding")).toBe(true);
    expect(kinds.has("risk")).toBe(true);
    expect(kinds.has("recommendation")).toBe(true);

    const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
    expect(edgeSet.has("doc-1->facts:doc-1")).toBe(true);
    expect(edgeSet.has("facts:doc-1->dim-financial")).toBe(true);
    expect(edgeSet.has("dim-financial->finding-financial-metrics")).toBe(true);
    expect(edgeSet.has("finding-financial-metrics->risk-runway")).toBe(true);
    expect(edgeSet.has("risk-runway->rec-1")).toBe(true);
  });

  it("collapses duplicate titles and clusters large corpora", () => {
    const evidence = Array.from({ length: 50 }, (_, i) =>
      ev(`doc-${i}`, `Unique Doc ${i}`, "governance"),
    );
    const { nodes } = buildEvidenceExplorerGraph({
      evidence,
      findings: [],
      risks: [],
      recommendations: [],
      clusterThreshold: 40,
    });
    expect(nodes.some((n) => n.kind === "cluster")).toBe(true);

    const dupes = [
      ev("a1", "Same Minutes", "governance"),
      ev("a2", "Same Minutes", "governance"),
      ev("a3", "Same Minutes.pdf", "governance"),
    ];
    const collapsed = buildEvidenceExplorerGraph({
      evidence: dupes,
      findings: [],
      risks: [],
      recommendations: [],
      clusterThreshold: 100,
    });
    const docs = collapsed.nodes.filter((n) => n.kind === "document");
    expect(docs.length).toBe(1);
    expect(docs[0]?.memberIds?.length).toBeGreaterThan(1);
  });

  it("layout produces non-overlapping positions in a rank", () => {
    const evidence = [ev("doc-1", "a.xlsx", "financial"), ev("doc-2", "b.xlsx", "financial")];
    const graph = buildEvidenceExplorerGraph({
      evidence,
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      clusterThreshold: 100,
    });
    const laid = layoutEvidenceExplorerGraph(graph.nodes, graph.edges);
    const docs = laid.nodes.filter((n) => n.kind === "document");
    if (docs.length >= 2) {
      const sorted = [...docs].sort((a, b) => a.y - b.y);
      expect(sorted[1]!.y).toBeGreaterThanOrEqual(sorted[0]!.y + 40);
    }
  });

  it("highlighting a document includes connected findings and risks", () => {
    const evidence = [ev("doc-1", "financials.xlsx", "financial")];
    const graph = buildEvidenceExplorerGraph({
      evidence,
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      clusterThreshold: 100,
    });
    const hi = collectHighlightIds("doc-1", graph.nodes, graph.edges);
    expect(hi.has("finding-financial-metrics")).toBe(true);
    expect(hi.has("risk-runway")).toBe(true);
    expect(hi.has("rec-1")).toBe(true);
  });

  it("records expose AI summary without raw TSV as primary copy", () => {
    const records = buildEvidenceExplorerRecords({
      evidence: [ev("doc-1", "financials.xlsx", "financial")],
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
    });
    expect(records[0]?.aiSummary).toContain("Financial metrics");
    expect(records[0]?.findingsCreated.length).toBe(1);
    expect(records[0]?.risksCreated.length).toBe(1);
    expect(records[0]?.rawExtract.length).toBeGreaterThan(0);
  });
});
