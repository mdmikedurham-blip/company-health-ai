import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import {
  analyzeCausalDrivers,
  buildCausalExecutiveBrief,
  computeScoreDelta,
  computeWeightedScore,
  deriveBusinessMateriality,
  rankDrivers,
} from "@/lib/intelligence/brief";
import { DEFAULT_AS_OF, runInsightEngine } from "@/lib/intelligence";
import {
  BASELINE_DIMENSION_SCORE,
  RUNWAY_POSITIVE,
  CONCENTRATION_HIGH,
} from "@/lib/intelligence/rules";

const AS_OF = DEFAULT_AS_OF;

function ev(
  overrides: Partial<Parameters<typeof createEvidence>[0]> &
    Pick<Parameters<typeof createEvidence>[0], "id" | "extractedFacts" | "dimensionIds">,
): Evidence {
  return createEvidence({
    sourceSystem: "Test",
    sourceType: "test",
    title: `Evidence ${overrides.id}`,
    contentSummary: "Test evidence",
    occurredAt: "2026-07-01",
    collectedAt: "Today, 6:00 AM",
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

function dim(
  id: string,
  name: string,
  score: number,
): HealthDimension {
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

describe("computeWeightedScore / rankDrivers", () => {
  it("ranks by impact × confidence × evidence quality", () => {
    expect(computeWeightedScore(10, 100, 100)).toBe(10);
    expect(computeWeightedScore(10, 50, 100)).toBe(5);
    expect(computeWeightedScore(-8, 100, 50)).toBe(4);

    const ranked = rankDrivers([
      {
        id: "a",
        title: "A",
        dimensionId: "dim-a",
        dimension: "A",
        direction: "positive",
        healthImpact: 4,
        impact: 4,
        confidence: 100,
        evidenceCount: 1,
        evidenceQuality: 100,
        businessMateriality: "low",
        reason: "a",
        weightedScore: computeWeightedScore(4, 100, 100, "low"),
        statement: "a",
        evidenceIds: ["ev-a"],
        timelineEventIds: [],
      },
      {
        id: "b",
        title: "B",
        dimensionId: "dim-b",
        dimension: "B",
        direction: "negative",
        healthImpact: -10,
        impact: -10,
        confidence: 100,
        evidenceCount: 2,
        evidenceQuality: 100,
        businessMateriality: "high",
        reason: "b",
        weightedScore: computeWeightedScore(-10, 100, 100, "high"),
        statement: "b",
        evidenceIds: ["ev-b"],
        timelineEventIds: [],
      },
    ]);
    expect(ranked[0]?.id).toBe("b");
    expect(ranked[1]?.id).toBe("a");
  });
});

describe("deriveBusinessMateriality", () => {
  it("classifies high / medium / low from impact, materiality, and evidence", () => {
    expect(
      deriveBusinessMateriality({
        findingMateriality: 9,
        impact: -14,
        evidenceCount: 1,
        confidence: 90,
        riskSeverity: "high",
      }),
    ).toBe("high");
    expect(
      deriveBusinessMateriality({
        findingMateriality: 6,
        impact: -5,
        evidenceCount: 2,
        confidence: 80,
      }),
    ).toBe("medium");
    expect(
      deriveBusinessMateriality({
        findingMateriality: 2,
        impact: 1,
        evidenceCount: 1,
        confidence: 60,
      }),
    ).toBe("low");
  });
});

describe("computeScoreDelta", () => {
  it("computes overall and dimension deltas against previous slice", () => {
    const delta = computeScoreDelta({
      healthScore: baseHealth(85),
      dimensions: [
        dim("dim-financial", "Financial", 90),
        dim("dim-governance", "Governance", 70),
      ],
      previous: {
        healthScore: { score: 82, confidence: 80 },
        dimensions: [
          { id: "dim-financial", name: "Financial", score: 85 },
          { id: "dim-governance", name: "Governance", score: 84 },
        ],
      },
    });
    expect(delta.change).toBe(3);
    expect(delta.byDimension.find((d) => d.dimensionId === "dim-financial")?.change).toBe(5);
    expect(delta.byDimension.find((d) => d.dimensionId === "dim-governance")?.change).toBe(-14);
  });
});

describe("causal brief — financial improvement", () => {
  it("headlines improvement and cites runway evidence", () => {
    const evidence = [
      ev({
        id: "ev-runway-strong",
        title: "Financial close completed",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 6 },
        reliability: 95,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-fin",
      evidence,
      previousHealthScore: baseHealth(BASELINE_DIMENSION_SCORE - 3),
      asOf: AS_OF,
    });
    const brief = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: {
        healthScore: {
          score: BASELINE_DIMENSION_SCORE - 3,
          confidence: 80,
        },
      },
      asOf: AS_OF,
    });

    expect(brief.headline).toMatch(/improved/i);
    expect(brief.scoreChange.change).toBeGreaterThan(0);
    expect(brief.primaryDrivers.some((d) => d.dimensionId === "dim-financial")).toBe(
      true,
    );
    expect(brief.evidenceReferences).toContain("ev-runway-strong");
    for (const driver of brief.primaryDrivers) {
      expect(driver.title.length).toBeGreaterThan(0);
      expect(driver.healthImpact).toBe(driver.impact);
      expect(driver.evidenceCount).toBe(driver.evidenceIds.length);
      expect(["high", "medium", "low"]).toContain(driver.businessMateriality);
      expect(driver.reason.length).toBeGreaterThan(0);
      expect(driver.statement).toMatch(/Evidence:/);
      expect(driver.evidenceIds.length).toBeGreaterThan(0);
    }
  });
});

describe("causal brief — governance decline", () => {
  it("surfaces board-approval as a negative primary driver", () => {
    const evidence = [
      ev({
        id: "ev-board-gap",
        title: "Board consent missing",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
        reliability: 92,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-gov",
      evidence,
      previousHealthScore: baseHealth(BASELINE_DIMENSION_SCORE),
      asOf: AS_OF,
    });
    const brief = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: {
        healthScore: { score: BASELINE_DIMENSION_SCORE, confidence: 80 },
      },
      asOf: AS_OF,
    });

    expect(brief.headline).toMatch(/declined/i);
    expect(brief.scoreChange.change).toBeLessThan(0);
    const gov = brief.primaryDrivers.find((d) => d.dimensionId === "dim-governance");
    expect(gov).toBeDefined();
    expect(gov!.impact).toBeLessThan(0);
    expect(gov!.healthImpact).toBe(gov!.impact);
    expect(gov!.businessMateriality).toBe("high");
    expect(gov!.evidenceCount).toBeGreaterThan(0);
    expect(gov!.reason.length).toBeGreaterThan(0);
    expect(gov!.evidenceIds).toContain("ev-board-gap");
    expect(brief.topRisks.length).toBeGreaterThan(0);
    expect(brief.recommendedActions.length).toBeGreaterThan(0);
  });
});

describe("causal brief — multiple simultaneous drivers", () => {
  it("ranks financial positive and concentration negative together", () => {
    const evidence = [
      ev({
        id: "ev-runway",
        title: "Financial close completed",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 4 },
        reliability: 90,
      }),
      ev({
        id: "ev-conc",
        title: "Customer concentration report",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
        reliability: 88,
      }),
      ev({
        id: "ev-soc2",
        title: "SOC2 review passed",
        dimensionIds: ["dim-security"],
        extractedFacts: { mfaCoverage: 0.99, openCriticalControls: 0 },
        reliability: 94,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-multi",
      evidence,
      previousHealthScore: baseHealth(80),
      asOf: AS_OF,
    });
    const brief = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: { healthScore: { score: 80, confidence: 80 } },
      asOf: AS_OF,
    });

    expect(brief.primaryDrivers.length + brief.secondaryDrivers.length).toBeGreaterThan(
      1,
    );
    const dims = new Set(
      [...brief.primaryDrivers, ...brief.secondaryDrivers].map((d) => d.dimensionId),
    );
    expect(dims.has("dim-financial") || dims.has("dim-customer")).toBe(true);
    expect(brief.evidenceReferences.length).toBeGreaterThan(1);

    const again = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: { healthScore: { score: 80, confidence: 80 } },
      asOf: AS_OF,
    });
    expect(again).toEqual(brief);
  });
});

describe("causal brief — no score change", () => {
  it("reports unchanged health when previous equals current", () => {
    const evidence = [
      ev({
        id: "ev-flat",
        title: "Baseline check",
        dimensionIds: ["dim-operations"],
        extractedFacts: {},
        reliability: 70,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-flat",
      evidence,
      previousHealthScore: undefined,
      asOf: AS_OF,
    });
    const brief = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: {
        healthScore: {
          score: engine.healthScore.score,
          confidence: engine.healthScore.confidence,
        },
      },
      asOf: AS_OF,
    });

    expect(brief.scoreChange.change).toBe(0);
    expect(brief.headline).toMatch(/unchanged/i);
  });
});

describe("causal brief — conflicting evidence", () => {
  it("flags conflict when positive and negative findings share a dimension", () => {
    const findings: Finding[] = [
      {
        id: "finding-low-attrition",
        title: "Low voluntary attrition",
        description: "Attrition is healthy.",
        dimensionId: "dim-people",
        dimension: "People",
        insightIds: [],
        evidenceIds: ["ev-attrition"],
        direction: "positive",
        materiality: 4,
        confidence: 85,
        scoreImpact: 5,
        summary: "",
        extractedAt: "2026-07-01",
        sourceSystem: "Test",
      },
      {
        id: "finding-key-person",
        title: "Key-person dependency",
        description: "Key person risk elevated.",
        dimensionId: "dim-people",
        dimension: "People",
        insightIds: [],
        evidenceIds: ["ev-key"],
        direction: "negative",
        materiality: 7,
        confidence: 80,
        scoreImpact: -5,
        summary: "",
        extractedAt: "2026-07-01",
        sourceSystem: "Test",
      },
    ];
    const evidence = [
      ev({
        id: "ev-attrition",
        dimensionIds: ["dim-people"],
        extractedFacts: { voluntaryAttritionRate: 0.04 },
      }),
      ev({
        id: "ev-key",
        dimensionIds: ["dim-people"],
        extractedFacts: { singleOwnerCriticalFunctions: ["Finance"] },
      }),
    ];
    const analysis = analyzeCausalDrivers({
      healthScore: baseHealth(85),
      dimensions: [dim("dim-people", "People", 85)],
      findings,
      risks: [],
      recommendations: [],
      evidence,
      timeline: [],
      previous: { healthScore: { score: 85, confidence: 80 } },
    });
    expect(analysis.conflictingEvidence).toBe(true);
    expect(analysis.confidence).toBeLessThan(80);

    const brief = buildCausalExecutiveBrief({
      healthScore: baseHealth(85),
      dimensions: [dim("dim-people", "People", 85)],
      findings,
      risks: [],
      recommendations: [],
      evidence,
      timeline: [],
      previous: { healthScore: { score: 85, confidence: 80 } },
      asOf: AS_OF,
    });
    expect(brief.overallSummary).toMatch(/Conflicting/i);
  });
});

describe("causal brief — insufficient evidence", () => {
  it("reduces confidence and states insufficient evidence", () => {
    const health = baseHealth(82);
    health.confidence = 70;
    const brief = buildCausalExecutiveBrief({
      healthScore: health,
      dimensions: [dim("dim-financial", "Financial", 82)],
      findings: [],
      risks: [] as Risk[],
      recommendations: [] as Recommendation[],
      evidence: [],
      timeline: [] as TimelineEvent[],
      previous: { healthScore: { score: 80, confidence: 70 } },
      asOf: AS_OF,
    });

    expect(brief.overallSummary).toMatch(/Insufficient evidence/i);
    expect(brief.confidence).toBeLessThanOrEqual(35);
    expect(brief.primaryDrivers.length).toBe(0);
    expect(brief.evidenceReferences.length).toBe(0);
  });
});

describe("causal brief — citation integrity", () => {
  it("never invents evidence IDs outside the input corpus", () => {
    const evidence = [
      ev({
        id: "ev-only",
        title: "Board consent added",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 2 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-cite",
      evidence,
      previousHealthScore: baseHealth(90),
      asOf: AS_OF,
    });
    const known = new Set(engine.evidence.map((e) => e.id));
    const brief = buildCausalExecutiveBrief({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      findings: engine.findings,
      risks: engine.risks,
      recommendations: engine.recommendations,
      evidence: engine.evidence,
      timeline: engine.timelineEvents,
      previous: { healthScore: { score: 90, confidence: 80 } },
      asOf: AS_OF,
    });

    for (const id of brief.evidenceReferences) {
      expect(known.has(id)).toBe(true);
    }
    for (const driver of [...brief.primaryDrivers, ...brief.secondaryDrivers]) {
      for (const id of driver.evidenceIds) {
        expect(known.has(id)).toBe(true);
      }
    }
  });
});
