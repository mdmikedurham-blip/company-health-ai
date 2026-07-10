import { describe, expect, it } from "vitest";
import {
  asRatio,
  formatPercent,
  NRR_RISK_THRESHOLD,
} from "@/lib/intelligence/rules";
import { analyzeEvidence } from "@/lib/intelligence/evidence-analyzer";
import { createEvidence } from "@/lib/connectors/create-evidence";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";

describe("asRatio / formatPercent percentage normalization", () => {
  it("keeps decimal ratios in (0, 1]", () => {
    expect(asRatio(0.58)).toBe(0.58);
    expect(asRatio(0.08)).toBe(0.08);
    expect(asRatio(1)).toBe(1);
    expect(formatPercent(asRatio(0.58)!)).toBe("58%");
  });

  it("keeps NRR-style multipliers like 1.08 as 108%", () => {
    expect(asRatio(1.08)).toBe(1.08);
    expect(formatPercent(asRatio(1.08)!)).toBe("108%");
    expect(asRatio(1.08)!).toBeGreaterThan(NRR_RISK_THRESHOLD);
  });

  it("converts whole-number percents to ratios", () => {
    expect(asRatio(58)).toBe(0.58);
    expect(asRatio(108)).toBe(1.08);
    expect(asRatio(95)).toBe(0.95);
    expect(formatPercent(asRatio(58)!)).toBe("58%");
    expect(formatPercent(asRatio(108)!)).toBe("108%");
  });

  it("treats values ≥ 10 as percent points even when fractional", () => {
    expect(asRatio(12.5)).toBe(0.125);
    expect(formatPercent(asRatio(12.5)!)).toBe("12.5%");
  });

  it("does not flag HubSpot-style NRR 1.08 as a risk", () => {
    const evidence = [
      createEvidence({
        id: "ev-nrr-good",
        sourceSystem: "HubSpot",
        sourceType: "report",
        title: "Revenue quality",
        contentSummary: "NRR at 108%",
        extractedFacts: { netRevenueRetention: 1.08 },
        dimensionIds: ["dim-revenue-quality"],
        occurredAt: "2026-07-01",
        collectedAt: "Today",
        reliability: 93,
      }),
    ];
    expect(analyzeEvidence(evidence)).toHaveLength(0);
    const result = runInsightEngine({
      companyId: "c1",
      evidence,
      asOf: DEFAULT_AS_OF,
    });
    expect(result.findings.some((f) => f.id === "finding-nrr")).toBe(false);
    expect(result.risks.some((r) => r.id === "risk-nrr")).toBe(false);
  });

  it("flags NRR when stored as whole-number percent below threshold", () => {
    const evidence = [
      createEvidence({
        id: "ev-nrr-low",
        sourceSystem: "HubSpot",
        sourceType: "report",
        title: "Revenue quality",
        contentSummary: "NRR at 85%",
        extractedFacts: { netRevenueRetention: 85 },
        dimensionIds: ["dim-revenue-quality"],
        occurredAt: "2026-07-01",
        collectedAt: "Today",
        reliability: 93,
      }),
    ];
    const insights = analyzeEvidence(evidence);
    expect(insights[0]?.ruleId).toBe("nrr");
    expect(insights[0]?.statement).toContain("85%");
  });

  it("accepts concentration as either 0.58 or 58", () => {
    const decimal = analyzeEvidence([
      createEvidence({
        id: "ev-a",
        sourceSystem: "Test",
        sourceType: "test",
        title: "A",
        contentSummary: "conc",
        extractedFacts: { top3CustomerArrShare: 0.58 },
        dimensionIds: ["dim-customer"],
        occurredAt: "2026-07-01",
        collectedAt: "Today",
        reliability: 90,
      }),
    ]);
    const whole = analyzeEvidence([
      createEvidence({
        id: "ev-b",
        sourceSystem: "Test",
        sourceType: "test",
        title: "B",
        contentSummary: "conc",
        extractedFacts: { top3CustomerArrShare: 58 },
        dimensionIds: ["dim-customer"],
        occurredAt: "2026-07-01",
        collectedAt: "Today",
        reliability: 90,
      }),
    ]);
    expect(decimal[0]?.ruleId).toBe("concentration-high");
    expect(whole[0]?.ruleId).toBe("concentration-high");
    expect(decimal[0]?.statement).toContain("58%");
    expect(whole[0]?.statement).toContain("58%");
  });
});
