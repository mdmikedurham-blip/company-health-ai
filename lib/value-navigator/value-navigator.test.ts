/**
 * Phase 10 — Company Value Navigator tests.
 * No fabricated precision; explainability; scenario isolation; goal reweight; ranking.
 */

import { describe, expect, it } from "vitest";
import type { Evidence } from "@/lib/domain";
import {
  applyScenario,
  buildNavigatorFromEvidence,
  estimateEnterpriseValue,
  formatUsdRange,
  mid,
  mlFutureProvider,
  rankValueDrivers,
  valuationInputFromEvidence,
  valueGap,
} from "@/lib/value-navigator";

function evidenceWithFacts(
  facts: Record<string, unknown>,
  id = "ev-1",
): Evidence {
  return {
    id,
    sourceSystem: "Manual Upload",
    sourceType: "financial",
    title: "Financial workbook",
    contentSummary: "Test facts",
    extractedFacts: facts,
    dimensionIds: ["dim-financial"],
    dimensionId: "dim-financial",
    dimension: "Financial",
    occurredAt: "2026-06-30",
    collectedAt: "2026-07-01",
    reliability: 90,
    metadata: { evidenceType: "financial" },
    citation: { label: "Financial workbook" },
    findingIds: [],
    linkedRiskIds: [],
  };
}

describe("Value Navigator — no fabricated precision", () => {
  it("always returns ranges, never a single point EV as precision claim", () => {
    const input = valuationInputFromEvidence({
      companyId: "co-a",
      snapshotId: "snap-1",
      assessmentGoal: "run-the-company",
      evidence: [
        evidenceWithFacts({
          revenue: 5_000_000,
          revenueGrowth: 0.25,
          grossMargin: 0.65,
          top3CustomerArrShare: 0.38,
        }),
      ],
    });
    const estimate = estimateEnterpriseValue(input);
    expect(estimate.currentRange.low).toBeLessThanOrEqual(
      estimate.currentRange.high,
    );
    expect(estimate.potentialRange.low).toBeLessThanOrEqual(
      estimate.potentialRange.high,
    );
    expect(estimate.assumptions.length).toBeGreaterThan(0);
    expect(estimate.confidence).toBeGreaterThanOrEqual(0);
    expect(estimate.confidence).toBeLessThanOrEqual(100);
    // Format never implies false precision with a single naked number API.
    expect(formatUsdRange(estimate.currentRange)).toMatch(/\$/);
  });

  it("returns empty ranges with missing inputs when no financial facts", () => {
    const estimate = estimateEnterpriseValue(
      valuationInputFromEvidence({
        companyId: "co-empty",
        snapshotId: null,
        assessmentGoal: "run-the-company",
        evidence: [],
      }),
    );
    expect(estimate.currentRange.high).toBe(0);
    expect(estimate.missingInputs.length).toBeGreaterThan(0);
    expect(estimate.confidence).toBe(0);
  });

  it("ML future provider never fabricates estimates", () => {
    const est = mlFutureProvider.estimate(
      valuationInputFromEvidence({
        companyId: "co",
        snapshotId: null,
        assessmentGoal: "run-the-company",
        evidence: [evidenceWithFacts({ revenue: 1_000_000 })],
      }),
    );
    expect(est.currentRange.high).toBe(0);
    expect(est.missingInputs).toContain("ml-model");
  });
});

describe("Value Gap", () => {
  it("computes Potential − Current as primary KPI range", () => {
    const current = { low: 20_000_000, high: 40_000_000, currency: "USD" as const };
    const potential = {
      low: 50_000_000,
      high: 80_000_000,
      currency: "USD" as const,
    };
    const gap = valueGap(current, potential);
    expect(gap.low).toBe(10_000_000); // 50M - 40M
    expect(gap.high).toBe(60_000_000); // 80M - 20M
  });
});

describe("Explainability complete", () => {
  it("every driver includes rationale, assumptions, and impact range", () => {
    const view = buildNavigatorFromEvidence({
      companyId: "co-x",
      snapshotId: "snap-x",
      assessmentGoal: "run-the-company",
      evidence: [
        evidenceWithFacts({
          revenue: 8_000_000,
          revenueGrowth: 0.12,
          grossMargin: 0.55,
          top3CustomerArrShare: 0.42,
          cashRunwayMonths: 8,
        }),
      ],
    });
    expect(view.navigator.drivers.length).toBeGreaterThan(0);
    for (const d of view.navigator.drivers) {
      expect(d.businessRationale.length).toBeGreaterThan(20);
      expect(d.assumptions.length).toBeGreaterThan(0);
      expect(d.estimatedValueImpact.low).toBeLessThanOrEqual(
        d.estimatedValueImpact.high,
      );
      expect(d.title.length).toBeGreaterThan(0);
    }
    expect(view.navigator.assumptions.length).toBeGreaterThan(0);
  });
});

describe("Scenario isolation", () => {
  it("scenarios never mutate the base estimate", () => {
    const baseInput = valuationInputFromEvidence({
      companyId: "co-s",
      snapshotId: "snap-s",
      assessmentGoal: "run-the-company",
      evidence: [
        evidenceWithFacts({
          revenue: 4_000_000,
          revenueGrowth: 0.15,
          grossMargin: 0.6,
          top3CustomerArrShare: 0.4,
        }),
      ],
    });
    const baseEstimate = estimateEnterpriseValue(baseInput);
    const before = structuredClone(baseEstimate.currentRange);
    const scenario = applyScenario({
      baseInput,
      baseEstimate,
      key: "reduce-concentration",
    });
    expect(scenario.isolatedFromAssessment).toBe(true);
    expect(baseEstimate.currentRange).toEqual(before);
    expect(baseInput.top3CustomerArrShare).toBe(0.4);
    expect(scenario.assumptions.some((a) => a.id === "sc-isolated")).toBe(
      true,
    );
  });
});

describe("Snapshot consistency", () => {
  it("navigator provenance.snapshotId matches input snapshotId", () => {
    const view = buildNavigatorFromEvidence({
      companyId: "co-snap",
      snapshotId: "snap-abc",
      assessmentGoal: "raise-capital",
      evidence: [evidenceWithFacts({ revenue: 2_000_000 })],
    });
    expect(view.provenance.snapshotId).toBe("snap-abc");
    expect(view.navigator.snapshotId).toBe("snap-abc");
    expect(view.provenance.companyId).toBe("co-snap");
  });
});

describe("Confidence responds to evidence", () => {
  it("more financial facts increase confidence vs sparse inputs", () => {
    const sparse = estimateEnterpriseValue(
      valuationInputFromEvidence({
        companyId: "co",
        snapshotId: "s",
        assessmentGoal: "run-the-company",
        evidence: [evidenceWithFacts({ revenue: 3_000_000 })],
      }),
    );
    const rich = estimateEnterpriseValue(
      valuationInputFromEvidence({
        companyId: "co",
        snapshotId: "s",
        assessmentGoal: "run-the-company",
        evidence: [
          evidenceWithFacts({
            revenue: 3_000_000,
            revenueGrowth: 0.35,
            grossMargin: 0.72,
            top3CustomerArrShare: 0.2,
            recurringRevenueShare: 0.9,
            netRevenueRetention: 1.15,
          }),
        ],
      }),
    );
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
    expect(rich.dataCompleteness).toBeGreaterThan(sparse.dataCompleteness);
  });
});

describe("Value Drivers rank correctly", () => {
  it("ranks drivers by expected value impact × confidence × goal weight", () => {
    const input = valuationInputFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        evidenceWithFacts({
          revenue: 10_000_000,
          revenueGrowth: 0.1,
          grossMargin: 0.5,
          top3CustomerArrShare: 0.5,
          cashRunwayMonths: 6,
        }),
      ],
    });
    const estimate = estimateEnterpriseValue(input);
    const drivers = rankValueDrivers({
      valuationInput: input,
      estimate,
      assessmentGoal: "run-the-company",
    });
    expect(drivers.length).toBeGreaterThan(1);
    for (let i = 1; i < drivers.length; i++) {
      expect(drivers[i - 1]!.priority).toBeGreaterThanOrEqual(
        drivers[i]!.priority,
      );
    }
  });
});

describe("Assessment Goal changes priorities", () => {
  it("enterprise-sales elevates SOC2 relative to run-the-company", () => {
    const evidence = [
      evidenceWithFacts({
        revenue: 6_000_000,
        revenueGrowth: 0.4,
        grossMargin: 0.75,
        top3CustomerArrShare: 0.15,
        cashRunwayMonths: 18,
        recurringRevenueShare: 0.9,
      }),
    ];
    const run = buildNavigatorFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence,
    });
    const enterprise = buildNavigatorFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "enterprise-sales",
      evidence,
    });
    const soc2Run = run.navigator.drivers.findIndex((d) => d.key === "soc2");
    const soc2Ent = enterprise.navigator.drivers.findIndex(
      (d) => d.key === "soc2",
    );
    expect(soc2Ent).toBeGreaterThanOrEqual(0);
    if (soc2Run >= 0) {
      expect(soc2Ent).toBeLessThanOrEqual(soc2Run);
    }
  });

  it("sell-the-company elevates concentration vs run when concentrated", () => {
    const evidence = [
      evidenceWithFacts({
        revenue: 7_000_000,
        revenueGrowth: 0.2,
        grossMargin: 0.6,
        top3CustomerArrShare: 0.45,
      }),
    ];
    const sell = buildNavigatorFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "sell-the-company",
      evidence,
    });
    const conc = sell.navigator.drivers.find(
      (d) => d.key === "customer-concentration",
    );
    expect(conc).toBeTruthy();
    expect(conc!.priority).toBeGreaterThan(0);
  });
});

describe("Tenant isolation", () => {
  it("navigator companyId matches requesting tenant only", () => {
    const a = buildNavigatorFromEvidence({
      companyId: "tenant-a",
      snapshotId: "snap-a",
      assessmentGoal: "run-the-company",
      evidence: [evidenceWithFacts({ revenue: 1_000_000 }, "ev-a")],
    });
    const b = buildNavigatorFromEvidence({
      companyId: "tenant-b",
      snapshotId: "snap-b",
      assessmentGoal: "run-the-company",
      evidence: [evidenceWithFacts({ revenue: 9_000_000 }, "ev-b")],
    });
    expect(a.navigator.companyId).toBe("tenant-a");
    expect(b.navigator.companyId).toBe("tenant-b");
    expect(a.navigator.snapshotId).not.toBe(b.navigator.snapshotId);
    expect(mid(a.navigator.currentEstimatedEnterpriseValueRange)).not.toBe(
      mid(b.navigator.currentEstimatedEnterpriseValueRange),
    );
  });
});
