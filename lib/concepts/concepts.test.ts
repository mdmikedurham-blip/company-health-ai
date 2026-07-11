import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type { Evidence } from "@/lib/domain";
import {
  aggregateBusinessConcepts,
  buildExplainabilityPath,
  BUSINESS_CONCEPT_CATALOG,
  BUSINESS_CONCEPT_IDS,
  conceptsForFactKey,
} from "@/lib/concepts";
import {
  answerDiligenceQuestions,
  conceptsForQuestion,
} from "@/lib/diligence";
import {
  CONCENTRATION_HIGH,
  RUNWAY_HIGH_RISK,
} from "@/lib/intelligence/rules";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";

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
    collectedAt: "Today",
    reliability: 90,
    metadata: { document_id: `doc-${overrides.id}` },
    ...overrides,
  });
}

describe("business concept ontology", () => {
  it("defines the canonical concept set without inventing extras", () => {
    expect(BUSINESS_CONCEPT_CATALOG.map((c) => c.id).sort()).toEqual(
      [...BUSINESS_CONCEPT_IDS].sort(),
    );
    expect(BUSINESS_CONCEPT_CATALOG.length).toBe(22);
  });

  it("maps facts to concepts correctly", () => {
    expect(conceptsForFactKey("cashRunwayMonths")).toContain("cash-management");
    expect(conceptsForFactKey("cashBalance")).toContain("cash-management");
    expect(conceptsForFactKey("boardApprovalsDocumented")).toContain(
      "corporate-approvals",
    );
    expect(conceptsForFactKey("revenue")).toContain("financial-performance");
    expect(conceptsForFactKey("top3CustomerArrShare")).toContain(
      "customer-concentration",
    );
    expect(conceptsForFactKey("revenueGrowthRate")).toContain(
      "financial-performance",
    );
  });
});

describe("concept aggregation", () => {
  it("aggregates confidence and supporting evidence from facts", () => {
    const evidence = [
      ev({
        id: "ev-cash",
        dimensionIds: ["dim-financial"],
        reliability: 92,
        extractedFacts: {
          cashRunwayMonths: RUNWAY_HIGH_RISK - 1,
          cashBalance: 500_000,
        },
      }),
    ];
    const concepts = aggregateBusinessConcepts({
      companyId: "co-a",
      evidence,
      snapshotId: "snap-1",
      asOf: "2026-07-09T00:00:00.000Z",
    });
    const cash = concepts.find((c) => c.conceptId === "cash-management");
    expect(cash).toBeTruthy();
    expect(cash!.supportingEvidenceIds).toContain("ev-cash");
    expect(cash!.supportingDocumentIds).toContain("doc-ev-cash");
    expect(cash!.supportingFactKeys).toEqual(
      expect.arrayContaining(["cashRunwayMonths", "cashBalance"]),
    );
    expect(cash!.supportingFactIds.some((id) => id.includes("cashRunwayMonths"))).toBe(
      true,
    );
    expect(cash!.confidence).toBe(92);
    expect(cash!.state).toBe("partial");
    expect(cash!.contradictingFactKeys).toContain("cashRunwayMonths");
    expect(cash!.snapshotId).toBe("snap-1");
  });

  it("marks cash-management contradicted when only runway is short", () => {
    const evidence = [
      ev({
        id: "ev-runway-only",
        dimensionIds: ["dim-financial"],
        reliability: 88,
        extractedFacts: { cashRunwayMonths: 3 },
      }),
    ];
    const concepts = aggregateBusinessConcepts({
      companyId: "co-a",
      evidence,
    });
    const cash = concepts.find((c) => c.conceptId === "cash-management");
    expect(cash!.state).toBe("contradicted");
  });

  it("does not hallucinate concepts with no facts", () => {
    const concepts = aggregateBusinessConcepts({
      companyId: "co-empty",
      evidence: [],
    });
    expect(concepts).toHaveLength(22);
    expect(concepts.every((c) => c.state === "unknown")).toBe(true);
    expect(concepts.every((c) => c.supportingEvidenceIds.length === 0)).toBe(
      true,
    );
    expect(concepts.every((c) => c.confidence === 0)).toBe(true);
  });
});

describe("questions evaluate concepts", () => {
  it("answers concentration via customer-concentration concept", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.05 },
      }),
    ];
    expect(conceptsForQuestion("q-cust-concentration")).toEqual([
      "customer-concentration",
    ]);
    const { answers, concepts } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
    });
    const concConcept = concepts.find(
      (c) => c.conceptId === "customer-concentration",
    );
    expect(concConcept?.state).toBe("contradicted");
    const answer = answers.find((a) => a.questionId === "q-cust-concentration");
    expect(answer?.state).toBe("CONTRADICTED");
    expect(answer?.conceptIds).toContain("customer-concentration");
    expect(answer?.supportingEvidenceIds).toContain("ev-conc");
  });

  it("explainability path links question → concept → evidence → document", () => {
    const evidence = [
      ev({
        id: "ev-runway",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: 4 },
      }),
    ];
    const { answers, concepts } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
      snapshotId: "snap-x",
    });
    const path = buildExplainabilityPath({
      questionId: "q-fin-runway-sufficient",
      answers,
      concepts,
    });
    expect(path).toBeTruthy();
    expect(path!.dimensionId).toBe("dim-financial");
    expect(path!.concepts.some((c) => c.conceptId === "cash-management")).toBe(
      true,
    );
    expect(path!.evidenceIds).toContain("ev-runway");
    expect(path!.documentIds).toContain("doc-ev-runway");
  });
});

describe("tenant isolation and snapshot consistency", () => {
  it("scopes concepts to companyId and snapshotId", () => {
    const evidence = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: 20 },
      }),
    ];
    const a = aggregateBusinessConcepts({
      companyId: "co-a",
      evidence,
      snapshotId: "snap-a",
    });
    const b = aggregateBusinessConcepts({
      companyId: "co-b",
      evidence: [],
      snapshotId: "snap-b",
    });
    expect(a.every((c) => c.companyId === "co-a")).toBe(true);
    expect(b.every((c) => c.companyId === "co-b")).toBe(true);
    expect(a.every((c) => c.snapshotId === "snap-a")).toBe(true);
    expect(b.every((c) => c.snapshotId === "snap-b")).toBe(true);
    expect(
      a.find((c) => c.conceptId === "cash-management")?.supportingFactKeys,
    ).toContain("cashRunwayMonths");
    expect(
      b.find((c) => c.conceptId === "cash-management")?.supportingFactKeys,
    ).toEqual([]);
  });

  it("engine findings still come only from question answers", () => {
    const evidence = [
      ev({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        extractedFacts: { agreementsMissingIpAssignment: 2 },
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-a",
      evidence,
      asOf: DEFAULT_AS_OF,
      classificationStage: "Growth",
    });
    expect(engine.businessConcepts.length).toBe(22);
    expect(engine.findings.some((f) => f.id === "finding-ip-gap")).toBe(true);
    expect(
      engine.recommendations.every(
        (r) =>
          (r.questionIds?.length ?? 0) > 0 ||
          r.rationale.includes("question="),
      ),
    ).toBe(true);
  });
});
