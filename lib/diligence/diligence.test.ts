import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors/create-evidence";
import type { Evidence } from "@/lib/domain";
import {
  CONCENTRATION_HIGH,
  RUNWAY_HIGH_RISK,
} from "@/lib/intelligence/rules";
import {
  answerDiligenceQuestions,
  buildDiligenceBundle,
  computeQuestionCoverage,
  DILIGENCE_QUESTION_CATALOG,
  deriveFindingsFromAnswers,
  generateRecommendationsFromAnswers,
  prioritizeQuestionIds,
  stageLevelForQuestion,
} from "@/lib/diligence";
import { getQuestionDefinition } from "@/lib/diligence/catalog";

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
    ...overrides,
  });
}

describe("diligence question catalog", () => {
  it("has 20–30 high-value questions across core dimensions", () => {
    expect(DILIGENCE_QUESTION_CATALOG.length).toBeGreaterThanOrEqual(20);
    expect(DILIGENCE_QUESTION_CATALOG.length).toBeLessThanOrEqual(30);
    const dims = new Set(DILIGENCE_QUESTION_CATALOG.map((q) => q.dimension));
    expect(dims.has("dim-financial")).toBe(true);
    expect(dims.has("dim-governance")).toBe(true);
    expect(dims.has("dim-legal")).toBe(true);
    expect(dims.has("dim-customer")).toBe(true);
    expect(dims.has("dim-security")).toBe(true);
    expect(dims.has("dim-operations")).toBe(true);
    expect(dims.has("dim-people")).toBe(true);
  });
});

describe("question answering", () => {
  it("answers concentration correctly and never fabricates", () => {
    const evidence = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.1 },
      }),
    ];
    const { answers, evaluations } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
      asOf: "2026-07-09T00:00:00.000Z",
    });
    const conc = answers.find((a) => a.questionId === "q-cust-concentration");
    expect(conc?.state).toBe("CONTRADICTED");
    expect(conc?.supportingEvidenceIds).toEqual(["ev-1"]);
    expect(evaluations.get("q-cust-concentration")?.findingRuleId).toBe(
      "concentration-high",
    );

    const growth = answers.find((a) => a.questionId === "q-fin-revenue-growing");
    expect(growth?.state).toBe("INSUFFICIENT_EVIDENCE");
    expect(growth?.reasoning).toMatch(/No revenueGrowth/);
  });

  it("keeps unsupported questions unsupported without hallucination", () => {
    const evidence = [
      ev({
        id: "ev-txt",
        dimensionIds: ["dim-operations"],
        extractedFacts: {},
        contentSummary: "Hello world narrative with no structured facts.",
      }),
    ];
    const { answers } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
    });
    const nrr = answers.find((a) => a.questionId === "q-cust-nrr");
    expect(nrr?.state).toBe("INSUFFICIENT_EVIDENCE");
    expect(nrr?.supportingEvidenceIds).toEqual([]);
    expect(answers.every((a) => a.state !== "UNKNOWN" || a.confidence === 0)).toBe(
      true,
    );
  });

  it("applies stage awareness — board approvals N/A at Idea", () => {
    const q = getQuestionDefinition("q-gov-board-approvals")!;
    expect(stageLevelForQuestion(q, "Idea")).toBe("not_applicable");
    expect(stageLevelForQuestion(q, "Growth")).toBe("required");

    const { answers } = answerDiligenceQuestions({
      companyId: "co-idea",
      evidence: [],
      stage: "Idea",
    });
    const board = answers.find((a) => a.questionId === "q-gov-board-approvals");
    expect(board?.state).toBe("NOT_APPLICABLE");
  });
});

describe("findings and recommendations from questions", () => {
  it("derives findings only from answered questions with evidence", () => {
    const evidence = [
      ev({
        id: "ev-runway",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_HIGH_RISK - 1 },
      }),
    ];
    const { evaluations } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
    });
    const findings = deriveFindingsFromAnswers(evaluations, evidence);
    expect(findings.some((f) => f.id === "finding-runway")).toBe(true);
    expect(findings.every((f) => f.evidenceIds.length > 0)).toBe(true);
  });

  it("recommendations only from contradicted or insufficient questions", () => {
    const evidence = [
      ev({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        extractedFacts: { agreementsMissingIpAssignment: 2 },
      }),
    ];
    const { answers } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
    });
    const recs = generateRecommendationsFromAnswers(answers, {
      evidenceCount: evidence.length,
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(
      recs.every(
        (r) =>
          r.rationale.includes("CONTRADICTED") ||
          r.rationale.includes("INSUFFICIENT"),
      ),
    ).toBe(true);
    expect(
      answers
        .filter((a) => a.state === "SUPPORTED")
        .every(
          (a) =>
            !recs.some(
              (r) =>
                getQuestionDefinition(a.questionId)?.recommendationTemplate
                  ?.id === r.id && a.state === "SUPPORTED",
            ),
        ),
    ).toBe(true);
  });
});

describe("coverage and assessment goals", () => {
  it("coverage uses question outcomes not document counts", () => {
    const evidence = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: 20 },
      }),
    ];
    const { answers } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
    });
    const coverage = computeQuestionCoverage({
      companyId: "co-a",
      answers,
      snapshotId: "snap-1",
    });
    expect(coverage.applicable).toBeGreaterThan(0);
    expect(coverage.supported + coverage.contradicted).toBeGreaterThan(0);
    expect(coverage.snapshotId).toBe("snap-1");
    expect(coverage.lackingEvidence).toBe(
      coverage.insufficientEvidence + coverage.unknown,
    );
  });

  it("assessment goals reorder priorities without changing answers", () => {
    const evidence = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.2 },
      }),
    ];
    const run = buildDiligenceBundle({
      companyId: "co-a",
      evidence,
      stage: "Growth",
      assessmentGoal: "run-the-company",
      asOf: "2026-07-09T00:00:00.000Z",
    });
    const capital = buildDiligenceBundle({
      companyId: "co-a",
      evidence,
      stage: "Growth",
      assessmentGoal: "raise-capital",
      asOf: "2026-07-09T00:00:00.000Z",
    });

    expect(run.answers.map((a) => `${a.questionId}:${a.state}`)).toEqual(
      capital.answers.map((a) => `${a.questionId}:${a.state}`),
    );
    expect(run.prioritizedQuestionIds).not.toEqual(
      capital.prioritizedQuestionIds,
    );
    // Same answers object equality on states
    for (let i = 0; i < run.answers.length; i++) {
      expect(run.answers[i]!.state).toBe(capital.answers[i]!.state);
      expect(run.answers[i]!.reasoning).toBe(capital.answers[i]!.reasoning);
    }
  });
});

describe("tenant isolation and one snapshot", () => {
  it("answers are scoped to companyId", () => {
    const evidence = [
      ev({
        id: "ev-1",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: 4 },
      }),
    ];
    const a = answerDiligenceQuestions({
      companyId: "co-a",
      evidence,
      stage: "Growth",
      snapshotId: "snap-a",
    });
    const b = answerDiligenceQuestions({
      companyId: "co-b",
      evidence: [],
      stage: "Growth",
      snapshotId: "snap-b",
    });
    expect(a.answers.every((x) => x.companyId === "co-a")).toBe(true);
    expect(b.answers.every((x) => x.companyId === "co-b")).toBe(true);
    expect(a.answers[0]!.snapshotId).toBe("snap-a");
    expect(b.answers[0]!.snapshotId).toBe("snap-b");
    expect(a.answers.find((x) => x.questionId === "q-fin-runway-sufficient")?.state).toBe(
      "CONTRADICTED",
    );
    expect(b.answers.find((x) => x.questionId === "q-fin-runway-sufficient")?.state).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });

  it("prioritizeQuestionIds is stable for a goal", () => {
    const { answers } = answerDiligenceQuestions({
      companyId: "co-a",
      evidence: [],
      stage: "Growth",
      assessmentGoal: "board-readiness",
    });
    const first = prioritizeQuestionIds(answers, "board-readiness");
    const second = prioritizeQuestionIds(answers, "board-readiness");
    expect(first).toEqual(second);
  });
});
