import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type {
  Finding,
  HealthScore,
  Recommendation,
  Risk,
  ScoreImpactExplanation,
} from "@/lib/domain";
import {
  buildProvenanceBundle,
  buildProvenanceGraph,
  buildProvenanceRecords,
  collectProvenancePath,
  hasOverlappingNodes,
  layoutProvenanceGraph,
  looksLikeBinaryOrPdfJunk,
} from "./index";

function ev(
  id: string,
  title: string,
  type: string,
  opts?: { summary?: string; facts?: Record<string, string | number | string[]> },
) {
  return createEvidence({
    id,
    sourceSystem: "Manual Upload",
    sourceType: type,
    title,
    contentSummary: opts?.summary ?? "Revenue\t100\nCash Balance\t50",
    extractedFacts: {
      evidenceType: type,
      revenue: 100,
      cashBalance: 50,
      financialMetricKeys: ["revenue", "cashBalance"],
      recommendedFindingTitle: "Financial metrics available",
      ...(opts?.facts ?? {}),
    },
    dimensionIds: ["dim-financial"],
    occurredAt: "2026-07-01",
    collectedAt: "2026-07-11T12:00:00.000Z",
    reliability: 88,
    metadata: { document_id: id },
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
  scoreImpact: 4,
  summary: "Metrics present",
  extractedAt: "2026-07-11",
  sourceSystem: "Manual Upload",
};

const risk: Risk = {
  id: "risk-runway",
  title: "Runway risk",
  summary: "Cash runway short",
  dimensionId: "dim-financial",
  dimension: "Financial",
  severity: "high",
  likelihood: 0.6,
  impact: 0.8,
  findingIds: ["finding-financial-metrics"],
  evidenceIds: ["doc-1"],
  confidence: 70,
  status: "open",
  estimatedScoreImpact: -8,
  whyItMatters: "Cash",
  recommendationId: "rec-1",
  recommendation: "Extend runway",
  primaryEvidenceLabel: "financials.xlsx",
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

const scoreExplanations: ScoreImpactExplanation[] = [
  {
    dimensionId: "dim-financial",
    baselineScore: 70,
    finalScore: 74,
    impacts: [
      {
        findingId: "finding-financial-metrics",
        impact: 4,
        reason: "Structured financial facts available",
        evidenceIds: ["doc-1"],
      },
    ],
  },
];

const healthScore: HealthScore = {
  score: 74,
  scoreAvailable: true,
  status: "watch",
  change: 0,
  changeLabel: "No prior",
  lastUpdated: "2026-07-11",
  confidence: 80,
  scoreExplanations,
};

describe("provenance hub", () => {
  it("builds document → fact → finding → risk → recommendation → score chain from persisted links", () => {
    const evidence = [ev("doc-1", "financials.xlsx", "financial")];
    const { nodes, edges } = buildProvenanceGraph({
      evidence,
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      healthScore,
      scoreExplanations,
      clusterThreshold: 100,
    });

    const kinds = new Set(nodes.map((n) => n.kind));
    expect(kinds.has("document")).toBe(true);
    expect(kinds.has("fact")).toBe(true);
    expect(kinds.has("dimension")).toBe(true);
    expect(kinds.has("finding")).toBe(true);
    expect(kinds.has("risk")).toBe(true);
    expect(kinds.has("recommendation")).toBe(true);
    expect(kinds.has("score")).toBe(true);

    const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
    expect(edgeSet.has("doc-1->facts:doc-1")).toBe(true);
    expect(edgeSet.has("facts:doc-1->finding-financial-metrics")).toBe(true);
    expect(edgeSet.has("finding-financial-metrics->dim-financial")).toBe(true);
    expect(edgeSet.has("finding-financial-metrics->risk-runway")).toBe(true);
    expect(edgeSet.has("risk-runway->rec-1")).toBe(true);
    expect(
      [...edgeSet].some((e) => e.startsWith("finding-financial-metrics->score:")),
    ).toBe(true);
  });

  it("document-to-finding traceability uses evidenceIds only", () => {
    const orphanFinding: Finding = {
      ...finding,
      id: "finding-orphan",
      evidenceIds: [],
    };
    const { edges } = buildProvenanceGraph({
      evidence: [ev("doc-1", "financials.xlsx", "financial")],
      findings: [orphanFinding],
      risks: [],
      recommendations: [],
      clusterThreshold: 100,
    });
    expect(
      edges.some(
        (e) =>
          e.source === "doc-1" && e.target === "finding-orphan",
      ),
    ).toBe(false);
  });

  it("score-to-source traceability follows score_explanations evidenceIds", () => {
    const { nodes, edges } = buildProvenanceGraph({
      evidence: [ev("doc-1", "financials.xlsx", "financial")],
      findings: [finding],
      risks: [],
      recommendations: [],
      scoreExplanations,
      clusterThreshold: 100,
    });
    const scoreNode = nodes.find((n) => n.kind === "score");
    expect(scoreNode).toBeTruthy();
    expect(scoreNode?.relatedDocumentIds).toContain("doc-1");
    expect(scoreNode?.relatedFindingIds).toContain("finding-financial-metrics");
    expect(
      edges.some(
        (e) =>
          e.source === "finding-financial-metrics" && e.target === scoreNode!.id,
      ),
    ).toBe(true);
  });

  it("does not fabricate edges when provenance is missing", () => {
    const bare = createEvidence({
      id: "bare-1",
      sourceSystem: "Manual Upload",
      sourceType: "pdf",
      title: "opaque.pdf",
      contentSummary: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj",
      extractedFacts: { evidenceType: "pdf" },
      dimensionIds: ["dim-governance"],
      occurredAt: "2026-07-01",
      collectedAt: "2026-07-11T12:00:00.000Z",
      reliability: 40,
    });
    const { nodes, edges } = buildProvenanceGraph({
      evidence: [bare],
      findings: [],
      risks: [],
      recommendations: [],
      clusterThreshold: 100,
    });
    const doc = nodes.find((n) => n.id === "bare-1");
    expect(doc?.provenanceAvailable).toBe(false);
    expect(edges.filter((e) => e.source === "bare-1").length).toBe(0);
  });

  it("layout produces non-overlapping initial node positions", () => {
    const evidence = [
      ev("doc-1", "a.xlsx", "financial"),
      ev("doc-2", "b.xlsx", "financial"),
      ev("doc-3", "c.xlsx", "governance"),
    ];
    const findings: Finding[] = [
      { ...finding, id: "f1", evidenceIds: ["doc-1"] },
      { ...finding, id: "f2", evidenceIds: ["doc-2"], title: "Second" },
      {
        ...finding,
        id: "f3",
        evidenceIds: ["doc-3"],
        dimensionId: "dim-governance",
        dimension: "Governance",
        title: "Gov",
      },
    ];
    const graph = buildProvenanceGraph({
      evidence,
      findings,
      risks: [risk],
      recommendations: [rec],
      scoreExplanations,
      clusterThreshold: 100,
    });
    const laid = layoutProvenanceGraph(graph.nodes, graph.edges, {
      skipCache: true,
    });
    expect(hasOverlappingNodes(laid.nodes)).toBe(false);
  });

  it("selection highlights connected upstream and downstream paths", () => {
    const evidence = [ev("doc-1", "financials.xlsx", "financial")];
    const graph = buildProvenanceGraph({
      evidence,
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      scoreExplanations,
      clusterThreshold: 100,
    });
    const { highlighted, breadcrumb } = collectProvenancePath(
      "finding-financial-metrics",
      graph.nodes,
      graph.edges,
    );
    expect(highlighted.has("doc-1")).toBe(true);
    expect(highlighted.has("risk-runway")).toBe(true);
    expect(highlighted.has("rec-1")).toBe(true);
    expect(breadcrumb.length).toBeGreaterThan(1);
  });

  it("hides raw PDF / binary text from default card summary", () => {
    const junk =
      "%PDF-1.7\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\nstream\n\x00\x01\x02";
    expect(looksLikeBinaryOrPdfJunk(junk)).toBe(true);

    const records = buildProvenanceRecords({
      evidence: [
        createEvidence({
          id: "pdf-1",
          sourceSystem: "Manual Upload",
          sourceType: "pdf",
          title: "scan.pdf",
          contentSummary: junk,
          extractedFacts: {
            evidenceType: "pdf",
            recommendedFindingTitle: "Board packet scanned",
          },
          dimensionIds: ["dim-governance"],
          occurredAt: "2026-07-01",
          collectedAt: "2026-07-11T12:00:00.000Z",
          reliability: 50,
        }),
      ],
      findings: [],
      risks: [],
      recommendations: [],
    });
    expect(records[0]?.aiSummary).toContain("Board packet");
    expect(records[0]?.aiSummary.includes("%PDF")).toBe(false);
    expect(records[0]?.rawExtractIsTechnicalOnly).toBe(true);
    expect(records[0]?.rawExtract.toLowerCase()).toContain("hidden");
  });

  it("scopes a bundle to one company_id and one snapshot_id", () => {
    const bundle = buildProvenanceBundle({
      companyId: "company-a",
      snapshotId: "snap-1",
      healthScoreId: "hs-1",
      asOf: "2026-07-11",
      evidence: [ev("doc-1", "financials.xlsx", "financial")],
      findings: [finding],
      risks: [risk],
      recommendations: [rec],
      healthScore,
    });
    expect(bundle.companyId).toBe("company-a");
    expect(bundle.snapshotId).toBe("snap-1");
    expect(bundle.healthScoreId).toBe("hs-1");
    // Never mixes a second snapshot id into the payload.
    expect(JSON.stringify(bundle).match(/snap-/g)?.length).toBe(1);
  });

  it("tenant isolation: separate company bundles do not share node ids from the other tenant's docs", () => {
    const a = buildProvenanceBundle({
      companyId: "tenant-a",
      snapshotId: "snap-a",
      healthScoreId: null,
      asOf: null,
      evidence: [ev("doc-a", "a.xlsx", "financial")],
      findings: [{ ...finding, id: "f-a", evidenceIds: ["doc-a"] }],
      risks: [],
      recommendations: [],
    });
    const b = buildProvenanceBundle({
      companyId: "tenant-b",
      snapshotId: "snap-b",
      healthScoreId: null,
      asOf: null,
      evidence: [ev("doc-b", "b.xlsx", "financial")],
      findings: [{ ...finding, id: "f-b", evidenceIds: ["doc-b"] }],
      risks: [],
      recommendations: [],
    });
    expect(a.companyId).not.toBe(b.companyId);
    expect(a.nodes.some((n) => n.id === "doc-b")).toBe(false);
    expect(b.nodes.some((n) => n.id === "doc-a")).toBe(false);
  });

  it("handles 500-node corpora without timing out", () => {
    const evidence = Array.from({ length: 500 }, (_, i) =>
      ev(`doc-${i}`, `Doc ${i}.xlsx`, i % 2 === 0 ? "financial" : "governance"),
    );
    const findings: Finding[] = evidence.slice(0, 40).map((e, i) => ({
      ...finding,
      id: `finding-${i}`,
      evidenceIds: [e.id],
      title: `Finding ${i}`,
    }));
    const start = performance.now();
    const graph = buildProvenanceGraph({
      evidence,
      findings,
      risks: [],
      recommendations: [],
      clusterThreshold: 36,
      maxInitialDocuments: 48,
    });
    const laid = layoutProvenanceGraph(graph.nodes, graph.edges, {
      skipCache: true,
    });
    const elapsed = performance.now() - start;
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.nodes.length).toBeLessThan(400);
    expect(hasOverlappingNodes(laid.nodes)).toBe(false);
    expect(elapsed).toBeLessThan(5000);
  });

  it("authenticated evidence page does not import demo/mock fallbacks", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const page = await fs.readFile(
      path.join(process.cwd(), "app/evidence/page.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/\bacme\b|mockSnapshot|getDemo|loadDemo|demo-acme/i);
    expect(page).toContain("company_id");
    expect(page).toContain("snapshot_id");
    expect(page).toContain("loadAuthenticatedDashboardView");
  });
});
