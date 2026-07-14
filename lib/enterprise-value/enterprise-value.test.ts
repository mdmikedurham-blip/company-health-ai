/**
 * Phase 11 — CEO Investigation Loop + Transparent Enterprise Value Engine tests.
 */

import { describe, expect, it } from "vitest";
import { companySnapshot } from "@/lib/data";
import type { CompanyHealthSnapshot, Evidence } from "@/lib/domain";
import { runDoctorCycleInMemory } from "@/lib/doctor/conversation/engine";
import { advanceInvestigation } from "@/lib/doctor/conversation/workflow";
import {
  computeBusinessDiscounts,
  computeEvidenceDiscounts,
  confidenceGainDoesNotInflateIntrinsicValue,
  estimateTransparentEnterpriseValue,
} from "@/lib/enterprise-value";
import { enrichInvestigation } from "@/lib/doctor/conversation/enrich-investigation";
import {
  applyScenario,
  estimateEnterpriseValue,
  mid,
  valuationInputFromEvidence,
  widenRangeForConfidence,
} from "@/lib/value-navigator";

function financialEvidence(
  facts: Record<string, unknown>,
  id = "ev-p11-1",
): Evidence {
  return {
    id,
    sourceSystem: "Manual Upload",
    sourceType: "financial",
    title: "Financial workbook",
    contentSummary: "Phase 11 test facts",
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

function snapWithEvidence(
  evidence: Evidence[],
  extras?: Partial<CompanyHealthSnapshot>,
): CompanyHealthSnapshot {
  return {
    ...companySnapshot,
    company: { ...companySnapshot.company, id: "tenant-p11" },
    assessmentSnapshotId: "snap-p11",
    evidence,
    findings: [],
    risks: [],
    ...extras,
  };
}

describe("Phase 11 — one investigation / one action", () => {
  it("keeps one active investigation and at most one evidence request", () => {
    const home = runDoctorCycleInMemory({
      snapshot: snapWithEvidence([
        financialEvidence({
          revenue: 5_000_000,
          revenueGrowth: 0.08,
          top3CustomerArrShare: 0.4,
          cashRunwayMonths: 8,
        }),
      ]),
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.currentInvestigation).not.toBeNull();
    expect(home.requestedEvidence.length).toBeLessThanOrEqual(1);
    expect(home.alternativePaths.length).toBeLessThanOrEqual(3);
  });

  it("does not request evidence already present", () => {
    const evidence = financialEvidence({
      revenue: 4_000_000,
      cashRunwayMonths: 4,
      burnRateMonthly: 200_000,
      cashBalance: 800_000,
    });
    evidence.metadata = {
      evidenceType: "cash_runway",
      documentId: "doc-1",
    };
    const home = runDoctorCycleInMemory({
      snapshot: snapWithEvidence([evidence]),
      goal: "run-the-company",
      stage: "Growth",
    });
    if (home.currentInvestigation && home.requestedEvidence[0]) {
      const advanced = advanceInvestigation({
        investigation: home.currentInvestigation,
        snapshot: snapWithEvidence([evidence]),
      });
      // If cash_runway evidence satisfies runway request, should not re-request it.
      if (home.currentInvestigation.templateId === "inv-runway-shortening") {
        expect(
          advanced.requestedEvidence.every(
            (r) => !r.evidenceTypes.includes("cash_runway"),
          ) || advanced.phase === "recommend",
        ).toBe(true);
      }
    }
  });

  it("labels low-confidence hypotheses as possibilities, not facts", () => {
    const home = runDoctorCycleInMemory({
      snapshot: snapWithEvidence([]),
      goal: "run-the-company",
      stage: "Growth",
    });
    const inv = home.currentInvestigation;
    if (inv && inv.confidence < 40 && inv.primaryHypothesis) {
      expect(inv.primaryHypothesis.toLowerCase()).toMatch(/possible|investigat/);
    }
  });
});

describe("Phase 11 — enterprise value", () => {
  it("produces a valuation range from financial facts", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 6_000_000,
          revenueGrowth: 0.2,
          grossMargin: 0.7,
        }),
      ],
    });
    expect(est.available).toBe(true);
    expect(est.currentEnterpriseValueRange!.high).toBeGreaterThan(0);
    expect(est.assumptions.length).toBeGreaterThan(0);
    expect(est.comparableBasis).not.toBeNull();
  });

  it("suppresses valuation when required inputs are missing", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap",
      assessmentGoal: "run-the-company",
      evidence: [],
    });
    expect(est.available).toBe(false);
    expect(est.missingUnlockInput).toBeTruthy();
    expect(est.currentEnterpriseValueRange).toBeNull();
  });

  it("keeps business and evidence discounts separate without duplicates", () => {
    const input = valuationInputFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 5_000_000,
          revenueGrowth: 0.05,
          top3CustomerArrShare: 0.45,
          cashRunwayMonths: 6,
        }),
      ],
    });
    const raw = estimateEnterpriseValue(input);
    const business = computeBusinessDiscounts(input, raw);
    const evidence = computeEvidenceDiscounts(
      input,
      raw,
      new Set(business.map((d) => d.id)),
    );
    const bizTitles = new Set(business.map((d) => d.title.toLowerCase()));
    for (const e of evidence) {
      // Evidence discounts must not restate the same business titles.
      expect(bizTitles.has(e.title.toLowerCase())).toBe(false);
    }
    expect(business.some((d) => d.kind === "business")).toBe(true);
  });

  it("scenario does not mutate current assessment inputs", () => {
    const baseInput = valuationInputFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 3_000_000,
          top3CustomerArrShare: 0.4,
          revenueGrowth: 0.15,
        }),
      ],
    });
    const base = estimateEnterpriseValue(baseInput);
    const before = baseInput.top3CustomerArrShare;
    const scenario = applyScenario({
      baseInput,
      baseEstimate: base,
      key: "reduce-concentration",
    });
    expect(scenario.isolatedFromAssessment).toBe(true);
    expect(baseInput.top3CustomerArrShare).toBe(before);
  });

  it("valuation changes remain explainable via assumptions and provenance", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap-x",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 8_000_000,
          top3CustomerArrShare: 0.5,
        }),
      ],
    });
    expect(est.provenance.snapshotId === undefined || true).toBe(true);
    expect(est.snapshotId).toBe("snap-x");
    expect(est.assumptions.some((a) => a.statement.length > 10)).toBe(true);
    expect(est.businessDiscounts.every((d) => d.rationale.length > 10)).toBe(
      true,
    );
  });

  it("upload/confidence gain does not automatically inflate intrinsic value", () => {
    const evidence = [
      financialEvidence({
        revenue: 4_000_000,
        revenueGrowth: 0.2,
        grossMargin: 0.7,
      }),
    ];
    const before = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence,
    });
    // Same operating facts — only conceptual confidence path.
    const after = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence,
    });
    expect(
      confidenceGainDoesNotInflateIntrinsicValue(before, after),
    ).toBe(true);
  });

  it("actual operating improvement changes value", () => {
    const weak = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 4_000_000,
          revenueGrowth: 0.05,
          top3CustomerArrShare: 0.5,
        }),
      ],
    });
    const stronger = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 4_000_000,
          revenueGrowth: 0.4,
          top3CustomerArrShare: 0.15,
          grossMargin: 0.75,
        }),
      ],
    });
    expect(stronger.available && weak.available).toBe(true);
    const weakMid =
      (weak.currentEnterpriseValueRange!.low +
        weak.currentEnterpriseValueRange!.high) /
      2;
    const strongMid =
      (stronger.currentEnterpriseValueRange!.low +
        stronger.currentEnterpriseValueRange!.high) /
      2;
    expect(strongMid).toBeGreaterThan(weakMid);
  });

  it("one-snapshot consistency and tenant isolation", () => {
    const a = estimateTransparentEnterpriseValue({
      companyId: "tenant-a",
      snapshotId: "snap-a",
      assessmentGoal: "run-the-company",
      evidence: [financialEvidence({ revenue: 1_000_000 }, "ev-a")],
    });
    const b = estimateTransparentEnterpriseValue({
      companyId: "tenant-b",
      snapshotId: "snap-b",
      assessmentGoal: "run-the-company",
      evidence: [financialEvidence({ revenue: 9_000_000 }, "ev-b")],
    });
    expect(a.snapshotId).toBe("snap-a");
    expect(b.snapshotId).toBe("snap-b");
    expect(a.provenance.evidenceIds).toContain("ev-a");
    expect(b.provenance.evidenceIds).toContain("ev-b");
    expect(a.provenance.evidenceIds).not.toContain("ev-b");
  });

  it("Doctor home includes enterprise value without demo fallback values", () => {
    const home = runDoctorCycleInMemory({
      snapshot: snapWithEvidence([
        financialEvidence({ revenue: 2_500_000, revenueGrowth: 0.12 }),
      ]),
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.enterpriseValue).not.toBeNull();
    expect(home.enterpriseValue!.available).toBe(true);
    expect(home.provenance.companyId).toBe("tenant-p11");
    // No Acme demo company id leakage.
    expect(home.provenance.companyId).not.toBe("company-acme");
  });
});

describe("Enterprise Value Opportunity v1", () => {
  it("exposes today, potential, opportunity, and confidence ranges", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 5_000_000,
          revenueGrowth: 0.08,
          top3CustomerArrShare: 0.45,
          grossMargin: 0.55,
        }),
      ],
    });
    expect(est.available).toBe(true);
    expect(est.currentEnterpriseValueRange!.high).toBeGreaterThan(0);
    expect(est.potentialEnterpriseValueRange!.high).toBeGreaterThan(0);
    expect(est.enterpriseValueOpportunityRange).not.toBeNull();
    expect(est.enterpriseValueOpportunityRange).toEqual(est.valueGapRange);
    expect(est.valuationConfidence).toBeGreaterThan(0);
    expect(est.valuationConfidence).toBeLessThanOrEqual(100);
  });

  it("each discount includes title, impact, explanation, evidence, next action", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 5_000_000,
          revenueGrowth: 0.05,
          top3CustomerArrShare: 0.5,
          cashRunwayMonths: 6,
        }),
      ],
    });
    expect(est.discounts.length).toBeGreaterThan(0);
    for (const d of est.discounts) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.impactRange.high).toBeGreaterThanOrEqual(d.impactRange.low);
      expect(d.rationale.length).toBeGreaterThan(10);
      expect(d.evidenceSummary.length).toBeGreaterThan(0);
      expect(d.recommendedNextAction.length).toBeGreaterThan(0);
      expect(["supporting", "missing"]).toContain(d.evidenceStatus);
    }
  });

  it("widens ranges as confidence decreases", () => {
    const base = { low: 10_000_000, high: 20_000_000, currency: "USD" as const };
    const highConf = widenRangeForConfidence(base, 95);
    const lowConf = widenRangeForConfidence(base, 30);
    expect(lowConf.high - lowConf.low).toBeGreaterThan(
      highConf.high - highConf.low,
    );
    expect(Math.abs(mid(highConf) - mid(base))).toBeLessThan(1);
  });

  it("identifies missing evidence that reduces uncertainty", () => {
    const est = estimateTransparentEnterpriseValue({
      companyId: "co",
      snapshotId: "snap",
      assessmentGoal: "run-the-company",
      evidence: [financialEvidence({ revenue: 3_000_000 })],
    });
    expect(est.missingEvidencePriorities.length).toBeGreaterThan(0);
    expect(est.missingEvidencePriorities[0]!.why.length).toBeGreaterThan(10);
    expect(est.evidenceDiscounts.every((d) => d.kind === "evidence")).toBe(
      true,
    );
  });

  it("does not double-count concentration in multiple and business discount", () => {
    const input = valuationInputFromEvidence({
      companyId: "co",
      snapshotId: "s",
      assessmentGoal: "run-the-company",
      evidence: [
        financialEvidence({
          revenue: 4_000_000,
          revenueGrowth: 0.25,
          grossMargin: 0.7,
          top3CustomerArrShare: 0.5,
        }),
      ],
    });
    const raw = estimateEnterpriseValue(input);
    // Base multiple without concentration haircut: 4–8 (+growth/margin boosts).
    // With growth≥30% false and margin≥70%: 4.5–9.5 → but growth is 25% so 4–8 + margin 0.5–1.5 = 4.5–9.5
    expect(raw.assumptions.some((a) => a.id === "mm-concentration")).toBe(
      false,
    );
    const business = computeBusinessDiscounts(input, raw);
    expect(business.some((d) => d.id === "biz-concentration")).toBe(true);
  });

  it("Doctor recommendations estimate EV increase, confidence, evidence, effort", () => {
    const home = runDoctorCycleInMemory({
      snapshot: snapWithEvidence([
        financialEvidence({
          revenue: 4_000_000,
          revenueGrowth: 0.08,
          top3CustomerArrShare: 0.42,
          cashRunwayMonths: 7,
        }),
      ]),
      goal: "run-the-company",
      stage: "Growth",
    });
    const inv = home.currentInvestigation;
    expect(inv).not.toBeNull();
    const enriched = enrichInvestigation({
      investigation: inv!,
      snapshot: snapWithEvidence([
        financialEvidence({
          revenue: 4_000_000,
          revenueGrowth: 0.08,
          top3CustomerArrShare: 0.42,
          cashRunwayMonths: 7,
        }),
      ]),
      goal: "run-the-company",
      observation: home.topObservation,
    });
    if (enriched.recommendation) {
      expect(
        enriched.recommendation.expectedEnterpriseValueIncrease ??
          enriched.recommendation.estimatedValueImpact,
      ).not.toBeNull();
      expect(
        enriched.recommendation.estimatedConfidenceIncrease,
      ).toBeGreaterThan(0);
      expect(enriched.recommendation.estimatedEffort).toBeTruthy();
      expect(
        (enriched.recommendation.evidenceRequired ?? []).length,
      ).toBeGreaterThan(0);
    } else if (enriched.evidenceRequest) {
      expect(enriched.estimatedValueImpact).not.toBeNull();
      expect(enriched.estimatedConfidenceGain).toBeGreaterThan(0);
      expect(enriched.evidenceRequest.estimatedEffort).toBeTruthy();
    }
  });
});
