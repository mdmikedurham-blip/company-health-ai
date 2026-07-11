import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type { Evidence } from "@/lib/domain";
import {
  buildCausalExecutiveBrief,
  computeScoreDelta,
} from "@/lib/intelligence/brief";
import { DEFAULT_AS_OF, runInsightEngine } from "@/lib/intelligence";
import {
  BASELINE_DIMENSION_SCORE,
  CONCENTRATION_HIGH,
  FINDING_POLICY,
} from "@/lib/intelligence/rules";
import { buildScoreChangeExplanation } from "@/lib/intelligence/scoring-engine";
import { companyBriefSeed } from "@/lib/data/company-profile";

const AS_OF = DEFAULT_AS_OF;

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
    collectedAt: "Today, 6:00 AM",
    reliability: 90,
    ...overrides,
  });
}

describe("score composition vs period delta", () => {
  it("separates currentScoreImpact from periodDelta", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-score",
      evidence,
      previousHealthScore: {
        score: 82,
        status: "watch",
        change: 0,
        changeLabel: "prior",
        lastUpdated: "Jun 1",
        confidence: 80,
      },
      asOf: AS_OF,
    });

    for (const driver of engine.scoreChange.drivers) {
      expect(driver).toHaveProperty("currentScoreImpact");
      expect(driver).toHaveProperty("periodDelta");
      expect(driver).not.toHaveProperty("impact");
    }

    const customer = engine.scoreChange.drivers.find(
      (d) => d.dimension === "Customer",
    );
    expect(customer?.currentScoreImpact).toBe(
      FINDING_POLICY["concentration-high"].scoreImpact,
    );
    // No prior dimension scores → periodDelta must stay 0 (not baseline deduction)
    expect(customer?.periodDelta).toBe(0);
    expect(engine.scoreChange.change).toBe(engine.healthScore.score - 82);
  });

  it("computeScoreDelta does not invent period change from baseline", () => {
    const evidence = [
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 2 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-delta",
      evidence,
      asOf: AS_OF,
    });
    const delta = computeScoreDelta({
      healthScore: engine.healthScore,
      dimensions: engine.dimensions,
      previous: {
        healthScore: {
          score: engine.healthScore.score,
          confidence: 80,
        },
      },
    });
    expect(delta.change).toBe(0);
    for (const d of delta.byDimension) {
      expect(d.change).toBe(0);
    }
  });

  it("periodDelta reflects real prior dimension scores when provided", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.6 },
      }),
      ev({
        id: "ev-runway",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: 20 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-prior",
      evidence,
      classificationStage: "Growth",
      asOf: AS_OF,
      asOf: AS_OF,
    });
    const explanation = buildScoreChangeExplanation(
      engine.healthScore,
      engine.healthScore.scoreExplanations ?? [],
      engine.findings,
      { ...engine.healthScore, score: 90 },
      [{ id: "dim-customer", score: BASELINE_DIMENSION_SCORE }],
    );
    const customer = explanation.drivers.find((d) => d.dimension === "Customer");
    expect(customer?.currentScoreImpact).toBe(
      FINDING_POLICY["concentration-high"].scoreImpact,
    );
    expect(customer?.periodDelta).toBe(
      FINDING_POLICY["concentration-high"].scoreImpact,
    );
  });
});

describe("board-prep item linkage", () => {
  it("gives each board item its own linked finding/risk evidence", () => {
    const evidence = [
      ev({
        id: "ev-board-gap",
        title: "Option grants",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
      }),
      ev({
        id: "ev-conc",
        title: "ARR cohort",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.58 },
      }),
      ev({
        id: "ev-sec",
        title: "SOC2 gaps",
        dimensionIds: ["dim-security"],
        extractedFacts: { openCriticalControls: 2, mfaCoverage: 0.9 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-board",
      evidence,
      previousHealthScore: {
        score: BASELINE_DIMENSION_SCORE,
        status: "healthy",
        change: 0,
        changeLabel: "prior",
        lastUpdated: "Jun 1",
        confidence: 80,
      },
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
      seed: companyBriefSeed,
      previous: {
        healthScore: { score: BASELINE_DIMENSION_SCORE, confidence: 80 },
      },
      asOf: AS_OF,
    });

    const byTitle = Object.fromEntries(
      brief.boardImplications.map((b) => [b.title, b]),
    );

    const boardApprovals = byTitle["Missing board approvals"];
    const concentration = byTitle["Customer concentration"];
    const security = byTitle["Security readiness gaps"];
    const financials = byTitle["Q2 financial results & forecast"];

    expect(boardApprovals?.evidenceIds).toContain("ev-board-gap");
    expect(boardApprovals?.detail).not.toMatch(/Board item linked to period drivers/);
    expect(concentration?.evidenceIds).toContain("ev-conc");
    expect(security?.evidenceIds).toContain("ev-sec");

    // Unmatched financials item must not reuse other items' evidence
    expect(financials?.evidenceIds).toEqual([]);
    expect(financials?.detail).toMatch(/No linked finding or risk/);

    const linkedEvidenceSets = [
      boardApprovals?.evidenceIds.join(","),
      concentration?.evidenceIds.join(","),
      security?.evidenceIds.join(","),
    ];
    expect(new Set(linkedEvidenceSets).size).toBe(3);
  });
});
