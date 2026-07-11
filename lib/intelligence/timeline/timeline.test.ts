import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
} from "@/lib/domain";
import {
  buildCausalTimeline,
  diffFindings,
  diffRisks,
  stableEventId,
  timelineEventKey,
} from "@/lib/intelligence/timeline";
import type { TimelinePreviousSlice } from "@/lib/intelligence/timeline";
import { DEFAULT_AS_OF, runInsightEngine } from "@/lib/intelligence";
import {
  CONCENTRATION_HIGH,
  RUNWAY_POSITIVE,
} from "@/lib/intelligence/rules";

const AS_OF = DEFAULT_AS_OF;
const COMPANY = "company-test";

function ev(
  overrides: Partial<Parameters<typeof createEvidence>[0]> &
    Pick<
      Parameters<typeof createEvidence>[0],
      "id" | "extractedFacts" | "dimensionIds"
    >,
): Evidence {
  return createEvidence({
    sourceSystem: "Test",
    sourceType: "test",
    title: `Evidence ${overrides.id}`,
    contentSummary: "Test evidence",
    occurredAt: "2026-07-01",
    collectedAt: "2026-07-01T12:00:00.000Z",
    reliability: 90,
    ...overrides,
  });
}

function baseHealth(score: number): HealthScore {
  return {
    score,
    status: score >= 85 ? "healthy" : score >= 70 ? "watch" : "critical",
    change: 0,
    changeLabel: "baseline",
    lastUpdated: "Jun 1, 2026",
    confidence: 80,
  };
}

function dim(id: string, name: string, score: number): HealthDimension {
  return {
    id,
    name,
    score,
    trend: { direction: "flat", value: 0 },
    status: score >= 85 ? "healthy" : score >= 70 ? "watch" : "critical",
    confidence: 80,
    evidenceCount: 1,
    owner: "Test",
    summary: `${name} at ${score}`,
    topDrivers: [],
    evidenceIds: [],
    findingIds: [],
    recommendedActions: [],
    whyItMatters: name,
    estimatedScoreImprovement: 0,
  };
}

function sliceFromEngine(
  engine: ReturnType<typeof runInsightEngine>,
  overrides?: Partial<TimelinePreviousSlice>,
): TimelinePreviousSlice {
  return {
    findings: engine.findings.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      dimensionId: f.dimensionId,
      scoreImpact: f.scoreImpact,
      materiality: f.materiality,
      confidence: f.confidence,
      evidenceIds: f.evidenceIds,
      direction: f.direction,
    })),
    risks: engine.risks.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      dimensionId: r.dimensionId,
      severity: r.severity,
      status: r.status,
      confidence: r.confidence,
      evidenceIds: r.evidenceIds,
      findingIds: r.findingIds,
      estimatedScoreImpact: r.estimatedScoreImpact,
    })),
    recommendations: engine.recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      priority: r.priority,
      evidenceIds: r.evidenceIds,
      riskIds: r.riskIds,
    })),
    dimensions: engine.dimensions.map((d) => ({
      id: d.id,
      name: d.name,
      score: d.score,
    })),
    healthScore: {
      score: engine.healthScore.score,
      confidence: engine.healthScore.confidence,
    },
    evidenceIds: engine.evidence.map((e) => e.id),
    ...overrides,
  };
}

describe("stableEventId", () => {
  it("is deterministic UUID (never prefixed tl- string)", () => {
    const a = stableEventId("finding-created", "finding-a");
    const b = stableEventId("finding-created", "finding-a");
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(a).not.toMatch(/^tl-/);
    expect(timelineEventKey("finding-created", "finding-a")).toBe(
      "tl-finding-created-finding-a",
    );
  });
});

describe("causal timeline — new document full chain", () => {
  it("links document → evidence → finding → risk → dimension → overall", () => {
    const evidence = [
      ev({
        id: "ev-board",
        title: "Board consent gap",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
        metadata: { documentId: "doc-board" },
      }),
    ];
    const engine = runInsightEngine({
      companyId: COMPANY,
      evidence,
      previousHealthScore: baseHealth(90),
      documents: [
        {
          id: "doc-board",
          title: "Board consent packet",
          connectorId: "google-drive",
          contentHash: "abc",
        },
      ],
      evidenceDocumentIds: { "ev-board": "doc-board" },
      asOf: AS_OF,
    });

    const types = engine.timelineEvents.map((e) => e.type);
    expect(types).toContain("document-added");
    expect(types).toContain("evidence-created");
    expect(types).toContain("finding-created");
    expect(types).toContain("risk-created");
    expect(types).toContain("dimension-score-changed");
    expect(types).toContain("overall-score-changed");

    const overall = engine.timelineEvents.find(
      (e) => e.type === "overall-score-changed",
    );
    expect(overall?.parentEventId).toBeTruthy();
    expect(overall?.rootEventId).toBeTruthy();
    expect(overall?.causalChainId).toBeTruthy();
    expect(overall?.findingIds.length).toBeGreaterThan(0);
    expect(overall?.evidenceIds).toContain("ev-board");

    const doc = engine.timelineEvents.find((e) => e.type === "document-added");
    const evEvent = engine.timelineEvents.find(
      (e) => e.type === "evidence-created",
    );
    expect(evEvent?.parentEventId).toBe(doc?.id);
    expect(evEvent?.rootEventId).toBe(doc?.id);
  });
});

describe("causal timeline — updated evidence changes finding", () => {
  it("emits finding-updated when scoreImpact changes", () => {
    const evidenceV1 = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.05 },
      }),
    ];
    const first = runInsightEngine({
      companyId: COMPANY,
      evidence: evidenceV1,
      asOf: AS_OF,
    });
    const prior = sliceFromEngine(first);

    // Same finding id, but bump materiality/impact via higher concentration
    // (still same finding id finding-concentration)
    const finding = first.findings.find((f) => f.id === "finding-concentration");
    expect(finding).toBeDefined();

    const updatedFindings: Finding[] = first.findings.map((f) =>
      f.id === "finding-concentration"
        ? { ...f, scoreImpact: f.scoreImpact - 2, materiality: f.materiality + 1 }
        : f,
    );

    const timeline = buildCausalTimeline({
      companyId: COMPANY,
      findings: updatedFindings,
      risks: first.risks,
      evidence: first.evidence,
      dimensions: first.dimensions,
      healthScore: first.healthScore,
      recommendations: first.recommendations,
      previous: prior,
      asOf: AS_OF,
    });

    const updated = timeline.find((e) => e.type === "finding-updated");
    expect(updated).toBeDefined();
    expect(updated?.findingIds).toContain("finding-concentration");
    expect(updated?.previousValue).toBe(finding!.scoreImpact);
    expect(updated?.currentValue).toBe(finding!.scoreImpact - 2);
  });
});

describe("causal timeline — risk severity change", () => {
  it("emits risk-updated when severity changes", () => {
    const evidence = [
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
      }),
    ];
    const first = runInsightEngine({
      companyId: COMPANY,
      evidence,
      asOf: AS_OF,
    });
    const prior = sliceFromEngine(first);
    const risk = first.risks[0];
    expect(risk).toBeDefined();

    const updatedRisks: Risk[] = first.risks.map((r, i) =>
      i === 0
        ? {
            ...r,
            severity: r.severity === "high" ? "medium" : "high",
          }
        : r,
    );

    const timeline = buildCausalTimeline({
      companyId: COMPANY,
      findings: first.findings,
      risks: updatedRisks,
      evidence: first.evidence,
      dimensions: first.dimensions,
      healthScore: first.healthScore,
      recommendations: first.recommendations,
      previous: prior,
      asOf: AS_OF,
    });

    const updated = timeline.find((e) => e.type === "risk-updated");
    expect(updated).toBeDefined();
    expect(updated?.summary).toMatch(/Severity/);
    expect(updated?.metadata.priorSeverity).toBe(risk!.severity);
  });
});

describe("causal timeline — risk resolution", () => {
  it("emits risk-resolved when prior open risk disappears", () => {
    const evidence = [
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 2 },
      }),
    ];
    const first = runInsightEngine({
      companyId: COMPANY,
      evidence,
      asOf: AS_OF,
    });
    expect(first.risks.length).toBeGreaterThan(0);
    const prior = sliceFromEngine(first);

    const timeline = buildCausalTimeline({
      companyId: COMPANY,
      findings: [],
      risks: [],
      evidence: first.evidence,
      dimensions: first.dimensions.map((d) => ({ ...d, score: 85 })),
      healthScore: baseHealth(85),
      recommendations: [],
      previous: prior,
      asOf: AS_OF,
    });

    const resolved = timeline.filter((e) => e.type === "risk-resolved");
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved[0]?.riskIds.length).toBeGreaterThan(0);
  });
});

describe("causal timeline — dimension and overall score change", () => {
  it("emits dimension-score-changed and overall-score-changed with links", () => {
    const evidence = [
      ev({
        id: "ev-runway",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 4 },
        metadata: { documentId: "doc-1" },
      }),
    ];
    const engine = runInsightEngine({
      companyId: COMPANY,
      evidence,
      previousHealthScore: baseHealth(78),
      documents: [{ id: "doc-1", title: "Close pack" }],
      evidenceDocumentIds: { "ev-runway": "doc-1" },
      asOf: AS_OF,
    });

    const dimEvent = engine.timelineEvents.find(
      (e) => e.type === "dimension-score-changed",
    );
    const overall = engine.timelineEvents.find(
      (e) => e.type === "overall-score-changed",
    );
    expect(dimEvent).toBeDefined();
    expect(dimEvent?.scoreDelta).not.toBe(0);
    expect(dimEvent?.findingIds.length).toBeGreaterThan(0);
    expect(overall).toBeDefined();
    expect(overall?.parentEventId).toBeTruthy();
    expect(overall?.scoreBefore).toBe(78);
  });
});

describe("causal timeline — duplicate prevention & determinism", () => {
  it("never duplicates event ids and is deterministic", () => {
    const evidence = [
      ev({
        id: "ev-a",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 3 },
      }),
      ev({
        id: "ev-b",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 1 },
      }),
    ];
    const a = runInsightEngine({
      companyId: COMPANY,
      evidence,
      previousHealthScore: baseHealth(80),
      asOf: AS_OF,
    });
    const b = runInsightEngine({
      companyId: COMPANY,
      evidence,
      previousHealthScore: baseHealth(80),
      asOf: AS_OF,
    });

    expect(a.timelineEvents).toEqual(b.timelineEvents);
    const ids = a.timelineEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("causal timeline — incomplete provenance", () => {
  it("flags evidence without source document", () => {
    const evidence = [
      ev({
        id: "ev-orphan",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 5 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: COMPANY,
      evidence,
      asOf: AS_OF,
    });
    const evEvent = engine.timelineEvents.find(
      (e) => e.type === "evidence-created",
    );
    expect(evEvent?.metadata.incompleteProvenance).toBe(true);
    expect(evEvent?.summary).toMatch(/Provenance incomplete/);
  });
});

describe("event-diff helpers", () => {
  it("classifies finding create/update/remove", () => {
    const prior: TimelinePreviousSlice["findings"] = [
      {
        id: "f1",
        title: "A",
        description: "d",
        dimensionId: "dim-financial",
        scoreImpact: 5,
        materiality: 5,
        confidence: 80,
        evidenceIds: ["e1"],
        direction: "positive",
      },
    ];
    const current: Finding[] = [
      {
        id: "f1",
        title: "A",
        description: "d",
        dimensionId: "dim-financial",
        dimension: "Financial",
        insightIds: [],
        evidenceIds: ["e1"],
        direction: "positive",
        materiality: 5,
        confidence: 80,
        scoreImpact: 3,
        summary: "",
        extractedAt: "2026-07-01",
        sourceSystem: "Test",
      },
      {
        id: "f2",
        title: "B",
        description: "d",
        dimensionId: "dim-governance",
        dimension: "Governance",
        insightIds: [],
        evidenceIds: ["e2"],
        direction: "negative",
        materiality: 8,
        confidence: 90,
        scoreImpact: -10,
        summary: "",
        extractedAt: "2026-07-01",
        sourceSystem: "Test",
      },
    ];
    const diff = diffFindings(prior, current);
    expect(diff.updated).toEqual(["f1"]);
    expect(diff.created).toEqual(["f2"]);
  });

  it("classifies risk resolution", () => {
    const prior: TimelinePreviousSlice["risks"] = [
      {
        id: "r1",
        title: "R",
        summary: "s",
        dimensionId: "dim-governance",
        severity: "high",
        status: "open",
        confidence: 90,
        evidenceIds: ["e1"],
        findingIds: ["f1"],
        estimatedScoreImpact: -10,
      },
    ];
    const diff = diffRisks(prior, []);
    expect(diff.resolved).toEqual(["r1"]);
  });
});

describe("causal timeline — unused fixtures compile", () => {
  it("keeps helper types available", () => {
    const d = dim("dim-financial", "Financial", 90);
    const r = [] as Recommendation[];
    expect(d.score).toBe(90);
    expect(r).toEqual([]);
  });
});
