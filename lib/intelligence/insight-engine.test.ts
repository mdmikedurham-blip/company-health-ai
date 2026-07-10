import { describe, expect, it } from "vitest";
import type { Evidence } from "@/lib/domain";
import { analyzeEvidence } from "@/lib/intelligence/evidence-analyzer";
import { deriveFindings } from "@/lib/intelligence/finding-engine";
import { assessRisks } from "@/lib/intelligence/risk-engine";
import {
  calculateConfidence,
  calculateDimensionScores,
  computeHealthFromFindings,
} from "@/lib/intelligence/scoring-engine";
import {
  computePriorityScore,
  generateRecommendations,
} from "@/lib/intelligence/recommendation-engine";
import { runInsightEngine } from "@/lib/intelligence";
import { BASELINE_DIMENSION_SCORE } from "@/lib/intelligence/rules";

function makeEvidence(
  overrides: Partial<Evidence> & Pick<Evidence, "id" | "extractedFacts" | "dimensionIds">,
): Evidence {
  const dimensionId = overrides.dimensionIds[0]!;
  const title = overrides.title ?? `Evidence ${overrides.id}`;
  const summary = overrides.contentSummary ?? "Test evidence";
  const reliability = overrides.reliability ?? 90;
  const collectedAt = overrides.collectedAt ?? "Today, 6:00 AM";

  return {
    sourceSystem: overrides.sourceSystem ?? "Test",
    sourceType: overrides.sourceType ?? "test",
    title,
    contentSummary: summary,
    dimensionId,
    dimension: overrides.dimension ?? dimensionId,
    occurredAt: overrides.occurredAt ?? "2026-07-01",
    collectedAt,
    reliability,
    metadata: overrides.metadata ?? {},
    citation: overrides.citation ?? { label: title },
    documentName: title,
    confidence: reliability,
    lastReviewed: collectedAt,
    summary,
    findingIds: [],
    linkedRiskIds: [],
    ...overrides,
  };
}

describe("customer concentration thresholds", () => {
  it("flags high risk when top-3 ARR share exceeds 50%", () => {
    const evidence = [
      makeEvidence({
        id: "ev-conc-high",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.58 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    const findings = deriveFindings(insights, evidence);
    const risks = assessRisks(findings, evidence);

    expect(insights.some((i) => i.statement.includes("high-risk"))).toBe(true);
    expect(findings.find((f) => f.id === "finding-concentration")?.scoreImpact).toBe(-8);
    expect(risks.find((r) => r.id === "risk-concentration")?.severity).toBe("high");
  });

  it("flags medium risk when top-3 ARR share is between 35% and 50%", () => {
    const evidence = [
      makeEvidence({
        id: "ev-conc-med",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.4 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    const findings = deriveFindings(insights, evidence);
    const risks = assessRisks(findings, evidence);

    expect(insights.some((i) => i.statement.includes("medium-risk"))).toBe(true);
    expect(findings.find((f) => f.id === "finding-concentration")?.scoreImpact).toBe(-4);
    expect(risks.find((r) => r.id === "risk-concentration")?.severity).toBe("medium");
  });

  it("does not flag concentration below 35%", () => {
    const evidence = [
      makeEvidence({
        id: "ev-conc-low",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.2 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    expect(insights.filter((i) => i.id.includes("concentration"))).toHaveLength(0);
  });
});

describe("missing intellectual-property assignment detection", () => {
  it("creates a legal finding and risk when agreements lack IP clauses", () => {
    const evidence = [
      makeEvidence({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        sourceSystem: "Box",
        extractedFacts: {
          agreementsMissingIpAssignment: 4,
          totalContractorAgreements: 12,
        },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });

    expect(result.findings.some((f) => f.id === "finding-ip-gap")).toBe(true);
    expect(result.findings.find((f) => f.id === "finding-ip-gap")?.dimensionId).toBe(
      "dim-legal",
    );
    expect(result.risks.some((r) => r.id === "risk-ip-gap")).toBe(true);
    expect(result.risks.find((r) => r.id === "risk-ip-gap")?.evidenceIds).toContain("ev-ip");
  });
});

describe("board approval detection", () => {
  it("creates a governance risk when option grants lack board approval", () => {
    const evidence = [
      makeEvidence({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        sourceSystem: "Carta",
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });

    expect(result.findings.some((f) => f.id === "finding-board-approval")).toBe(true);
    expect(result.risks.some((r) => r.id === "risk-board-approval")).toBe(true);
    expect(result.risks.find((r) => r.id === "risk-board-approval")?.dimensionId).toBe(
      "dim-governance",
    );
  });
});

describe("score calculation", () => {
  it("starts dimensions at 85 and applies finding impacts", () => {
    const evidence = [
      makeEvidence({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.6 },
        reliability: 95,
      }),
    ];
    const insights = analyzeEvidence(evidence);
    const findings = deriveFindings(insights, evidence);
    const { dimensions } = calculateDimensionScores(findings, evidence, ["dim-customer"]);

    const customer = dimensions.find((d) => d.id === "dim-customer")!;
    expect(BASELINE_DIMENSION_SCORE).toBe(85);
    expect(customer.score).toBe(85 - 8); // high concentration impact
    expect(customer.score).toBeGreaterThanOrEqual(0);
    expect(customer.score).toBeLessThanOrEqual(100);
  });

  it("produces overall health as weighted dimensions", () => {
    const evidence = [
      makeEvidence({
        id: "ev-recurring",
        dimensionIds: ["dim-revenue-quality"],
        extractedFacts: { recurringRevenueShare: 0.9 },
        reliability: 90,
      }),
    ];
    const insights = analyzeEvidence(evidence);
    const findings = deriveFindings(insights, evidence);
    const { healthScore, dimensions } = computeHealthFromFindings(findings, evidence);

    expect(healthScore.score).toBeGreaterThanOrEqual(0);
    expect(healthScore.score).toBeLessThanOrEqual(100);
    expect(dimensions.length).toBeGreaterThan(0);
    expect(healthScore.scoreExplanations?.length).toBe(dimensions.length);
  });
});

describe("confidence calculation", () => {
  it("reduces confidence when evidence is missing", () => {
    expect(calculateConfidence([])).toBe(40);
  });

  it("increases confidence with fresh, reliable evidence", () => {
    const rich = [
      makeEvidence({
        id: "a",
        dimensionIds: ["dim-financial"],
        extractedFacts: {},
        reliability: 98,
        collectedAt: "Today, 6:00 AM",
      }),
      makeEvidence({
        id: "b",
        dimensionIds: ["dim-legal"],
        extractedFacts: {},
        reliability: 95,
        collectedAt: "Today, 7:00 AM",
      }),
      makeEvidence({
        id: "c",
        dimensionIds: ["dim-customer"],
        extractedFacts: {},
        reliability: 94,
        collectedAt: "Yesterday, 4:00 PM",
      }),
      makeEvidence({
        id: "d",
        dimensionIds: ["dim-security"],
        extractedFacts: {},
        reliability: 92,
        collectedAt: "Today, 5:00 AM",
      }),
    ];
    const sparse = [
      makeEvidence({
        id: "old",
        dimensionIds: ["dim-financial"],
        extractedFacts: {},
        reliability: 60,
        collectedAt: "2024-01-01",
      }),
    ];

    expect(calculateConfidence(rich)).toBeGreaterThan(calculateConfidence(sparse));
    expect(calculateConfidence(rich)).toBeGreaterThan(70);
  });
});

describe("recommendation ranking", () => {
  it("ranks by priorityScore = improvement × severity × confidence ÷ effort", () => {
    const high = computePriorityScore({
      estimatedScoreImprovement: 8,
      severity: "high",
      confidence: 90,
      effort: "low",
    });
    const low = computePriorityScore({
      estimatedScoreImprovement: 8,
      severity: "low",
      confidence: 90,
      effort: "high",
    });
    expect(high).toBeGreaterThan(low);

    const evidence = [
      makeEvidence({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        extractedFacts: { agreementsMissingIpAssignment: 2, totalContractorAgreements: 5 },
        reliability: 91,
      }),
      makeEvidence({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.55 },
        reliability: 94,
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    const scores = result.recommendations.map((r) => r.priorityScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);

    const regenerated = generateRecommendations(result.risks, result.findings);
    expect(regenerated[0]!.priorityScore).toBeGreaterThanOrEqual(
      regenerated[regenerated.length - 1]!.priorityScore,
    );
  });
});

describe("full mock corpus integration", () => {
  it("runs the Acme mock evidence through the engine", async () => {
    const { mockEvidence } = await import("@/lib/data/mock-evidence");
    const { previousHealthScore, dimensionProfiles } = await import(
      "@/lib/data/company-profile"
    );
    const result = runInsightEngine({
      companyId: "company-acme",
      evidence: mockEvidence,
      previousHealthScore,
      dimensionProfiles,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBe(result.risks.length);
    expect(result.healthScore.score).toBeGreaterThanOrEqual(0);
    expect(result.healthScore.score).toBeLessThanOrEqual(100);
    expect(result.insights.some((i) => i.id.includes("concentration"))).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-ip-gap")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-board-approval")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-security-readiness")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-low-attrition")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-key-person")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-recurring-revenue")).toBe(true);
  });
});
