import { describe, expect, it } from "vitest";
import type { Evidence, Finding, HealthDimension, Risk } from "@/lib/domain";
import {
  computeAffectedScope,
  mergeIncrementalIntelligence,
} from "./affected-scope";

function evidence(partial: Partial<Evidence> & Pick<Evidence, "id">): Evidence {
  return {
    sourceSystem: "Google Drive",
    sourceType: "financial",
    title: partial.id,
    contentSummary: "",
    extractedFacts: { cashRunwayMonths: 6 },
    dimensionIds: ["dim-financial"],
    dimensionId: "dim-financial",
    dimension: "Financial",
    occurredAt: "2026-01-01",
    collectedAt: "2026-01-01",
    reliability: 80,
    metadata: {},
    citation: { label: partial.id },
    findingIds: [],
    linkedRiskIds: [],
    ...partial,
  };
}

describe("computeAffectedScope", () => {
  it("maps changed docs → findings → risks → dimensions", () => {
    const scope = computeAffectedScope([
      evidence({ id: "gdrive-1", extractedFacts: { cashRunwayMonths: 4 } }),
    ]);
    expect(scope.findingIds).toContain("finding-runway");
    expect(scope.riskIds).toContain("risk-runway");
    expect(scope.dimensionIds).toContain("dim-financial");
  });

  it("maps concentration facts to customer dimension", () => {
    const scope = computeAffectedScope([
      evidence({
        id: "gdrive-2",
        dimensionId: "dim-customer",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.6 },
      }),
    ]);
    expect(scope.findingIds).toContain("finding-concentration");
    expect(scope.riskIds).toContain("risk-concentration");
    expect(scope.dimensionIds).toContain("dim-customer");
  });
});

describe("mergeIncrementalIntelligence", () => {
  it("updates only affected findings/risks/dimensions", () => {
    const priorFindings = [
      {
        id: "finding-runway",
        title: "old runway",
        description: "old",
        dimensionId: "dim-financial",
        dimension: "Financial",
        insightIds: [],
        evidenceIds: ["gdrive-1"],
        direction: "negative",
        materiality: 9,
        confidence: 80,
        scoreImpact: -12,
        summary: "old",
        extractedAt: "2026-01-01",
        sourceSystem: "Google Drive",
      },
      {
        id: "finding-concentration",
        title: "keep me",
        description: "keep",
        dimensionId: "dim-customer",
        dimension: "Customer",
        insightIds: [],
        evidenceIds: ["gdrive-other"],
        direction: "negative",
        materiality: 9,
        confidence: 80,
        scoreImpact: -8,
        summary: "keep",
        extractedAt: "2026-01-01",
        sourceSystem: "Google Drive",
      },
    ] as Finding[];

    const priorRisks = [
      {
        id: "risk-runway",
        title: "Cash runway risk",
        summary: "old",
        dimensionId: "dim-financial",
        dimension: "Financial",
        severity: "high",
        likelihood: 0.8,
        impact: 0.8,
        findingIds: ["finding-runway"],
        evidenceIds: ["gdrive-1"],
        confidence: 80,
        status: "open",
        estimatedScoreImpact: 12,
        whyItMatters: "",
        recommendationId: "rec-extend-runway",
        recommendation: "",
        primaryEvidenceLabel: "",
        explainPrompt: "",
      },
      {
        id: "risk-concentration",
        title: "Customer concentration",
        summary: "keep",
        dimensionId: "dim-customer",
        dimension: "Customer",
        severity: "high",
        likelihood: 0.8,
        impact: 0.8,
        findingIds: ["finding-concentration"],
        evidenceIds: ["gdrive-other"],
        confidence: 80,
        status: "open",
        estimatedScoreImpact: 8,
        whyItMatters: "",
        recommendationId: "rec-diversify-customers",
        recommendation: "",
        primaryEvidenceLabel: "",
        explainPrompt: "",
      },
    ] as Risk[];

    const priorDimensions = [
      { id: "dim-financial", name: "Financial", score: 73 },
      { id: "dim-customer", name: "Customer", score: 77 },
    ] as HealthDimension[];

    const nextFindings = [
      {
        ...priorFindings[0]!,
        title: "new runway",
        scoreImpact: -6,
      },
    ];
    const nextRisks = [
      {
        ...priorRisks[0]!,
        summary: "new",
      },
    ];
    const nextDimensions = [
      { id: "dim-financial", name: "Financial", score: 79 },
      { id: "dim-customer", name: "Customer", score: 77 },
    ] as HealthDimension[];

    const merged = mergeIncrementalIntelligence({
      scope: {
        evidenceIds: ["gdrive-1"],
        ruleIds: ["runway-medium"],
        findingIds: ["finding-runway"],
        riskIds: ["risk-runway"],
        dimensionIds: ["dim-financial"],
      },
      priorFindings,
      priorRisks,
      priorDimensions,
      nextFindings,
      nextRisks,
      nextDimensions,
    });

    expect(merged.findingsUpsert).toHaveLength(1);
    expect(merged.findingsUpsert[0]?.title).toBe("new runway");
    expect(merged.findings.find((f) => f.id === "finding-concentration")?.title).toBe(
      "keep me",
    );
    expect(merged.risks.find((r) => r.id === "risk-concentration")).toBeTruthy();
    expect(merged.dimensions.find((d) => d.id === "dim-financial")?.score).toBe(79);
    expect(merged.dimensions.find((d) => d.id === "dim-customer")?.score).toBe(77);
    expect(merged.dimensionsChanged).toContain("dim-financial");
  });
});
