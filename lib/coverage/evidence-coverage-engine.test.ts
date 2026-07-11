import { describe, expect, it } from "vitest";
import type { Evidence } from "@/lib/domain";
import { computeEvidenceCoverage } from "./compute-evidence-coverage";
import { expectationLevelForItem } from "./category-catalog";

function makeEvidence(
  partial: Partial<Evidence> & Pick<Evidence, "id" | "title" | "contentSummary">,
): Evidence {
  return {
    sourceSystem: "manual-upload",
    sourceType: "document",
    extractedFacts: {},
    dimensionIds: ["dim-financial"],
    dimensionId: "dim-financial",
    dimension: "Financial",
    occurredAt: "2026-07-01T00:00:00.000Z",
    collectedAt: "2026-07-01T00:00:00.000Z",
    reliability: 0.9,
    metadata: { documentId: partial.id },
    citation: { label: partial.title },
    findingIds: [],
    linkedRiskIds: [],
    ...partial,
  };
}

describe("expectationLevelForItem", () => {
  it("marks board minutes not applicable at Idea", () => {
    expect(expectationLevelForItem("Idea", "board-minutes")).toBe(
      "not_applicable",
    );
  });

  it("requires board minutes at Growth", () => {
    expect(expectationLevelForItem("Growth", "board-minutes")).toBe("required");
  });

  it("requires SOC2 at Scale", () => {
    expect(expectationLevelForItem("Scale", "soc2")).toBe("required");
  });
});

describe("computeEvidenceCoverage", () => {
  it("computes coverage metrics for Growth with partial evidence", () => {
    const evidence = [
      makeEvidence({
        id: "e1",
        title: "2026 Master Financials.xlsx",
        contentSummary: "Financial statements with revenue and cash",
        extractedFacts: {
          financialFactsComplete: true,
          revenue: 2_400_000,
          cashBalance: 900_000,
          cashRunwayMonths: 18,
          top3CustomerArrShare: 0.42,
        },
        dimensionId: "dim-financial",
        dimension: "Financial",
      }),
      makeEvidence({
        id: "e2",
        title: "Peachjar BOD Meeting Minutes 20160318.pdf",
        contentSummary: "Board minutes approving financing",
        extractedFacts: {
          boardApprovalsDocumented: true,
          boardMeetingDate: "2016-03-18",
        },
        dimensionId: "dim-governance",
        dimension: "Governance",
      }),
      makeEvidence({
        id: "e3",
        title: "Certificate of Incorporation.pdf",
        contentSummary: "Certificate of incorporation for the company",
        dimensionId: "dim-legal",
        dimension: "Legal",
      }),
    ];

    const report = computeEvidenceCoverage({
      evidence,
      stage: "Growth",
      generatedAt: "2026-07-11T12:00:00.000Z",
    });

    expect(report.stage).toBe("Growth");
    expect(report.evidenceCount).toBe(3);
    expect(report.requiredTotal).toBeGreaterThan(0);
    expect(report.requiredComplete).toBeGreaterThan(0);
    expect(report.requiredCompletePct).toBeGreaterThan(0);
    expect(report.requiredCompletePct).toBeLessThan(100);
    expect(report.coveragePct).toBeGreaterThan(0);
    expect(report.missingRequired.length).toBeGreaterThan(0);
    expect(report.missingRecommended.length).toBeGreaterThanOrEqual(0);

    const financial = report.categories.find((c) => c.categoryId === "financial");
    expect(financial).toBeTruthy();
    const statements = financial!.items.find(
      (i) => i.itemId === "historical-financial-statements",
    );
    expect(statements?.uploaded).toBe(true);
    expect(statements?.verified).toBe(true);
    expect(statements?.supportingDocuments[0]?.title).toContain("Financials");
    expect(statements?.whyItMatters.length).toBeGreaterThan(10);

    const governance = report.categories.find(
      (c) => c.categoryId === "governance",
    );
    expect(
      governance?.items.find((i) => i.itemId === "board-minutes")?.uploaded,
    ).toBe(true);

    const legal = report.categories.find((c) => c.categoryId === "legal");
    expect(
      legal?.items.find((i) => i.itemId === "incorporation")?.uploaded,
    ).toBe(true);

    // MFA required at Growth but missing
    expect(
      report.missingRequired.some((i) => i.itemId === "mfa"),
    ).toBe(true);
  });

  it("treats Idea stage with mostly N/A items", () => {
    const report = computeEvidenceCoverage({
      evidence: [],
      stage: "Idea",
    });
    expect(report.requiredTotal).toBe(0);
    expect(report.requiredCompletePct).toBe(0);
    const board = report.categories
      .find((c) => c.categoryId === "governance")
      ?.items.find((i) => i.itemId === "board-minutes");
    expect(board?.level).toBe("not_applicable");
    expect(board?.missing).toBe(false);
  });

  it("includes all seven categories", () => {
    const report = computeEvidenceCoverage({
      evidence: [],
      stage: "Growth",
    });
    expect(report.categories.map((c) => c.categoryId)).toEqual([
      "financial",
      "governance",
      "legal",
      "customer",
      "security",
      "operations",
      "people",
    ]);
  });

  it("marks customer metrics from extracted facts", () => {
    const report = computeEvidenceCoverage({
      evidence: [
        makeEvidence({
          id: "c1",
          title: "Customer metrics.xlsx",
          contentSummary: "ARR churn NRR",
          extractedFacts: {
            netRevenueRetention: 1.12,
            churnRate: 0.04,
            top3CustomerArrShare: 0.35,
            arr: 4_000_000,
          },
          dimensionId: "dim-customer",
          dimension: "Customer",
        }),
      ],
      stage: "Growth",
    });
    const customer = report.categories.find((c) => c.categoryId === "customer")!;
    expect(customer.items.find((i) => i.itemId === "nrr")?.verified).toBe(true);
    expect(customer.items.find((i) => i.itemId === "churn")?.verified).toBe(true);
    expect(customer.items.find((i) => i.itemId === "arr")?.verified).toBe(true);
    expect(
      customer.items.find((i) => i.itemId === "concentration")?.verified,
    ).toBe(true);
  });
});
