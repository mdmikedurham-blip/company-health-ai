import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type { Evidence, HealthDimension, HealthScore } from "@/lib/domain";
import {
  calculateConfidence,
  calculateDimensionScores,
  calculateOverallHealth,
  computeHealthFromFindings,
} from "@/lib/intelligence/scoring-engine";
import {
  BASELINE_DIMENSION_SCORE,
  CONFIDENCE_EMPTY,
  CONCENTRATION_HIGH,
  FINDING_POLICY,
} from "@/lib/intelligence/rules";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";
import {
  isLegacyBaselineOnlySnapshot,
  sanitizeHealthAssessment,
} from "@/lib/dashboard/sanitize-health";

const AS_OF = new Date(DEFAULT_AS_OF);

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

describe("scoring without fabricated defaults", () => {
  it("no evidence → no overall score", () => {
    const result = computeHealthFromFindings([], [], undefined, undefined, AS_OF);
    expect(result.healthScore.scoreAvailable).toBe(false);
    expect(result.healthScore.status).toBe("insufficient");
    expect(result.healthScore.confidence).toBe(0);
    expect(result.scoreChange.hasPriorSnapshot).toBe(false);
    expect(result.scoreChange.change).toBe(0);
  });

  it("partial evidence → only supported dimensions scored", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-partial",
      evidence,
      asOf: AS_OF,
    });

    const customer = engine.dimensions.find((d) => d.id === "dim-customer");
    expect(customer?.scored).toBe(true);
    expect(customer?.score).toBe(
      BASELINE_DIMENSION_SCORE +
        FINDING_POLICY["concentration-high"].scoreImpact,
    );

    const others = engine.dimensions.filter((d) => d.id !== "dim-customer");
    expect(others.every((d) => d.scored === false)).toBe(true);
    expect(others.every((d) => d.status === "insufficient")).toBe(true);
    expect(others.every((d) => d.score === 0)).toBe(true);
    expect(engine.healthScore.scoreAvailable).toBe(true);
    expect(engine.healthScore.score).toBe(customer?.score);
  });

  it("one snapshot → no score delta", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-one",
      evidence,
      asOf: AS_OF,
    });
    expect(engine.scoreChange.hasPriorSnapshot).toBe(false);
    expect(engine.scoreChange.change).toBe(0);
    expect(engine.healthScore.change).toBe(0);
  });

  it("all dimensions cannot inherit the same fallback score", () => {
    const { dimensions } = calculateDimensionScores(
      [],
      [],
      ["dim-financial", "dim-customer", "dim-legal"],
      AS_OF,
    );
    expect(dimensions.every((d) => d.score === BASELINE_DIMENSION_SCORE)).toBe(
      false,
    );
    expect(new Set(dimensions.map((d) => d.score)).size).toBe(1);
    expect(dimensions[0]?.score).toBe(0);
    expect(dimensions.every((d) => !d.scored)).toBe(true);
  });

  it("confidence is not hardcoded at 95", () => {
    expect(CONFIDENCE_EMPTY).toBe(0);
    expect(calculateConfidence([], AS_OF)).toBe(0);

    const sparse = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-customer"],
        extractedFacts: {},
        reliability: 50,
        collectedAt: "2020-01-01T00:00:00.000Z",
      }),
    ];
    const rich = Array.from({ length: 10 }, (_, i) =>
      ev({
        id: `ev-r-${i}`,
        dimensionIds: ["dim-customer"],
        extractedFacts: {},
        reliability: 95,
        collectedAt: "Today",
      }),
    );

    const sparseConf = calculateConfidence(sparse, AS_OF);
    const richConf = calculateConfidence(rich, AS_OF);
    expect(sparseConf).not.toBe(95);
    expect(richConf).not.toBe(CONFIDENCE_EMPTY);
    expect(richConf).toBeGreaterThan(sparseConf);
  });

  it("prior insufficient snapshot does not create a delta", () => {
    const prior: HealthScore = {
      score: 0,
      scoreAvailable: false,
      status: "insufficient",
      change: 0,
      changeLabel: "No assessment yet",
      lastUpdated: "Jun 1",
      confidence: 0,
    };
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-prior",
      evidence,
      previousHealthScore: prior,
      asOf: AS_OF,
    });
    expect(engine.scoreChange.hasPriorSnapshot).toBe(false);
    expect(engine.healthScore.change).toBe(0);
  });
});

describe("sanitize legacy baseline-85 snapshots", () => {
  it("strips all-85 zero-finding assessments", () => {
    const dimensions: HealthDimension[] = [
      {
        id: "dim-financial",
        name: "Financial",
        score: 85,
        scored: true,
        trend: { direction: "flat", value: 0 },
        status: "healthy",
        confidence: 95,
        evidenceCount: 5,
        owner: "",
        summary: "ok",
        topDrivers: [],
        evidenceIds: [],
        findingIds: [],
        recommendedActions: [],
        whyItMatters: "",
        estimatedScoreImprovement: 0,
      },
      {
        id: "dim-customer",
        name: "Customer",
        score: 85,
        scored: true,
        trend: { direction: "flat", value: 0 },
        status: "healthy",
        confidence: 95,
        evidenceCount: 5,
        owner: "",
        summary: "ok",
        topDrivers: [],
        evidenceIds: [],
        findingIds: [],
        recommendedActions: [],
        whyItMatters: "",
        estimatedScoreImprovement: 0,
      },
    ];

    expect(
      isLegacyBaselineOnlySnapshot({
        healthScore: {
          score: 85,
          scoreAvailable: true,
          status: "healthy",
          change: 68,
          changeLabel: "+68 vs prior",
          lastUpdated: "now",
          confidence: 95,
        },
        dimensions,
        findingsCount: 0,
      }),
    ).toBe(true);

    const sanitized = sanitizeHealthAssessment({
      healthScore: {
        score: 85,
        scoreAvailable: true,
        status: "healthy",
        change: 68,
        changeLabel: "+68 vs prior",
        lastUpdated: "now",
        confidence: 95,
      },
      dimensions,
      scoreChange: {
        previousScore: 17,
        currentScore: 85,
        change: 68,
        hasPriorSnapshot: true,
        period: "Current assessment",
        summary: "moved",
        drivers: [],
      },
      findingsCount: 0,
    });

    expect(sanitized.healthScore.scoreAvailable).toBe(false);
    expect(sanitized.healthScore.score).toBe(0);
    expect(sanitized.healthScore.confidence).toBe(0);
    expect(sanitized.healthScore.change).toBe(0);
    expect(sanitized.dimensions.every((d) => !d.scored)).toBe(true);
    expect(sanitized.scoreChange.hasPriorSnapshot).toBe(false);
    expect(sanitized.scoreChange.change).toBe(0);
  });
});

describe("overall health from scored dims only", () => {
  it("ignores unscored dimensions in the weighted average", () => {
    const dims: HealthDimension[] = [
      {
        id: "dim-customer",
        name: "Customer",
        score: 70,
        scored: true,
        trend: { direction: "flat", value: 0 },
        status: "watch",
        confidence: 80,
        evidenceCount: 1,
        owner: "",
        summary: "",
        topDrivers: [],
        evidenceIds: ["e1"],
        findingIds: ["f1"],
        recommendedActions: [],
        whyItMatters: "",
        estimatedScoreImprovement: 0,
        weight: 1,
      },
      {
        id: "dim-financial",
        name: "Financial",
        score: 0,
        scored: false,
        trend: { direction: "flat", value: 0 },
        status: "insufficient",
        confidence: 0,
        evidenceCount: 0,
        owner: "",
        summary: "Not enough evidence",
        topDrivers: [],
        evidenceIds: [],
        findingIds: [],
        recommendedActions: [],
        whyItMatters: "",
        estimatedScoreImprovement: 0,
        weight: 1,
      },
    ];
    const overall = calculateOverallHealth(dims, [], undefined, AS_OF);
    expect(overall.scoreAvailable).toBe(true);
    expect(overall.score).toBe(70);
  });
});
