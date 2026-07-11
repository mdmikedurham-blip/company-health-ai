import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import {
  applyConfirmedOverrides,
  classifyCompanyFromEvidence,
} from "./classify-company";
import {
  expectationsForStage,
  isDimensionRelevantForStage,
} from "./expectation-matrix";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("company classification", () => {
  it("idea-stage company is not penalized for lacking a board", () => {
    const evidence = [
      createEvidence({
        id: "ev-founder",
        sourceSystem: "Manual Upload",
        sourceType: "governance",
        title: "Founder notes.txt",
        contentSummary: "Early idea notes and MVP sketch. No revenue yet.",
        extractedFacts: { evidenceType: "general" },
        dimensionIds: ["dim-product"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 50,
      }),
    ];
    const result = classifyCompanyFromEvidence({ evidence });
    expect(result.stage === "Idea" || result.stage === "Pre-product / MVP").toBe(
      true,
    );
    const board = expectationsForStage(result.stage).find(
      (e) => e.documentClass === "board-minutes",
    );
    expect(board?.level).toBe("not_applicable");
    expect(isDimensionRelevantForStage(result.stage, "dim-security")).toBe(false);
    expect(
      expectationsForStage(result.stage).some(
        (e) => e.documentClass === "board-minutes" && e.level === "not_applicable",
      ),
    ).toBe(true);
  });

  it("growth-stage company with investors expects governance", () => {
    const evidence = [
      createEvidence({
        id: "ev-fin",
        sourceSystem: "Manual Upload",
        sourceType: "financial",
        title: "financials.xlsx",
        contentSummary: "Revenue 2500000 cash 900000",
        extractedFacts: {
          revenue: 2_500_000,
          cashBalance: 900_000,
          financialMetricKeys: ["revenue", "cashBalance"],
          financialFactsComplete: true,
        },
        dimensionIds: ["dim-financial"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 88,
      }),
      createEvidence({
        id: "ev-raise",
        sourceSystem: "Manual Upload",
        sourceType: "governance",
        title: "Series A term sheet.pdf",
        contentSummary: "Series A outside investor Horizon Ventures",
        extractedFacts: {
          financingApprovalsDocumented: true,
          evidenceType: "governance",
        },
        dimensionIds: ["dim-governance"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 80,
      }),
    ];
    const result = classifyCompanyFromEvidence({ evidence });
    expect(["Growth", "Scale", "Product-Market Fit"]).toContain(result.stage);
    const board = expectationsForStage(result.stage).find(
      (e) => e.documentClass === "board-minutes",
    );
    expect(["required", "recommended"]).toContain(board?.level);
    expect(result.effective.boardRequired).toBe(true);
  });

  it("one financial workbook does not produce overall health", () => {
    const evidence = [
      createEvidence({
        id: "ev-fin-only",
        sourceSystem: "Manual Upload",
        sourceType: "financial",
        title: "company-financials.xlsx",
        contentSummary: "Revenue and cash workbook",
        extractedFacts: {
          revenue: 2_400_000,
          cashBalance: 900_000,
          cashRunwayMonths: 20,
          burnRateMonthly: 45_000,
          grossMargin: 0.72,
          financialMetricKeys: [
            "revenue",
            "cashBalance",
            "cashRunwayMonths",
            "burnRateMonthly",
            "grossMargin",
          ],
          financialFactsComplete: true,
        },
        dimensionIds: ["dim-financial"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 90,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-one-fin",
      evidence,
      asOf: DEFAULT_AS_OF,
    });
    const financial = engine.dimensions.find((d) => d.id === "dim-financial");
    expect(financial?.scored).toBe(true);
    expect(engine.healthScore.scoreAvailable).toBe(false);
  });

  it("unsupported dimensions remain unscored; irrelevant are not applicable", () => {
    const evidence = [
      createEvidence({
        id: "ev-idea",
        sourceSystem: "Manual Upload",
        sourceType: "general",
        title: "idea-notes.txt",
        contentSummary: "Founder idea notebook. MVP sketch.",
        extractedFacts: {},
        dimensionIds: ["dim-product"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 40,
      }),
    ];
    const engine = runInsightEngine({
      companyId: "co-idea",
      evidence,
      asOf: DEFAULT_AS_OF,
      classificationStage: "Idea",
    });
    const security = engine.dimensions.find((d) => d.id === "dim-security");
    // Idea stage: security not in relevant set for Idea
    expect(security?.applicable).toBe(false);
    expect(security?.status).toBe("not_applicable");
    expect(security?.scored).toBe(false);

    const financial = engine.dimensions.find((d) => d.id === "dim-financial");
    expect(financial?.applicable).toBe(false);
    expect(financial?.status).toBe("not_applicable");
  });

  it("user-confirmed stage overrides inference", () => {
    const evidence = [
      createEvidence({
        id: "ev-1",
        sourceSystem: "Manual Upload",
        sourceType: "general",
        title: "notes.txt",
        contentSummary: "Early notes only",
        extractedFacts: {},
        dimensionIds: ["dim-product"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 40,
      }),
    ];
    const inferred = classifyCompanyFromEvidence({ evidence });
    const overridden = classifyCompanyFromEvidence({
      evidence,
      confirmed: { stage: "Growth" },
    });
    expect(inferred.stage).not.toBe("Growth");
    expect(overridden.stage).toBe("Growth");
    expect(overridden.fieldProvenance.stage?.origin).toBe("user-confirmed");

    const merged = applyConfirmedOverrides(inferred.inferred, {
      stage: "Scale",
      boardPresent: true,
    });
    expect(merged.stage).toBe("Scale");
    expect(merged.boardPresent).toBe(true);
    // Re-inference must not wipe confirmed when passed through
    const again = classifyCompanyFromEvidence({
      evidence,
      confirmed: { stage: "Scale" },
    });
    expect(again.stage).toBe("Scale");
  });

  it("tenant isolation: classification result is scoped to provided evidence only", () => {
    const tenantA = classifyCompanyFromEvidence({
      evidence: [
        createEvidence({
          id: "a-1",
          sourceSystem: "Manual Upload",
          sourceType: "financial",
          title: "a.xlsx",
          contentSummary: "Revenue 12000000 Series B",
          extractedFacts: { revenue: 12_000_000 },
          dimensionIds: ["dim-financial"],
          occurredAt: "2026-07-01",
          collectedAt: "2026-07-11T12:00:00.000Z",
          reliability: 90,
        }),
      ],
    });
    const tenantB = classifyCompanyFromEvidence({
      evidence: [
        createEvidence({
          id: "b-1",
          sourceSystem: "Manual Upload",
          sourceType: "general",
          title: "b.txt",
          contentSummary: "Idea notebook",
          extractedFacts: {},
          dimensionIds: ["dim-product"],
          occurredAt: "2026-07-01",
          collectedAt: "2026-07-11T12:00:00.000Z",
          reliability: 40,
        }),
      ],
    });
    expect(tenantA.sourceEvidenceIds).toEqual(["a-1"]);
    expect(tenantB.sourceEvidenceIds).toEqual(["b-1"]);
    expect(tenantA.stage).not.toBe(tenantB.stage);
  });

  it("no mock/demo fallback in classification module or upload page", () => {
    const classifySrc = readFileSync(
      join(process.cwd(), "lib/classification/classify-company.ts"),
      "utf8",
    );
    const uploadSrc = readFileSync(
      join(process.cwd(), "app/upload/page.tsx"),
      "utf8",
    );
    expect(classifySrc).not.toMatch(/\bacme\b|getDemo|mockSnapshot|companyProfile/i);
    expect(uploadSrc).not.toMatch(/\bacme\b|getDemo|loadDemo|demo-acme/i);
    expect(uploadSrc).toContain("getCompanyClassification");
  });

  it("classification uses one consistent snapshot id when persisted shape is built", () => {
    const evidence = [
      createEvidence({
        id: "ev-snap",
        sourceSystem: "Manual Upload",
        sourceType: "financial",
        title: "fin.xlsx",
        contentSummary: "Revenue 500000 first customers",
        extractedFacts: {
          revenue: 500_000,
          top3CustomerArrShare: 0.4,
        },
        dimensionIds: ["dim-financial"],
        occurredAt: "2026-07-01",
        collectedAt: "2026-07-11T12:00:00.000Z",
        reliability: 80,
      }),
    ];
    const result = classifyCompanyFromEvidence({
      evidence,
      scoredDimensionIds: ["dim-financial"],
    });
    // Pure classify has no snapshot; persistence layer attaches exactly one.
    expect(result.sourceEvidenceIds).toEqual(["ev-snap"]);
    expect(new Set(result.sourceEvidenceIds).size).toBe(1);
  });
});
