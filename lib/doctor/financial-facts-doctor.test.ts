import { describe, expect, it } from "vitest";
import { companySnapshot } from "@/lib/data";
import type { CompanyHealthSnapshot, Evidence } from "@/lib/domain";
import { askDoctor } from "./doctor-service";
import { classifyQuery } from "./query-classifier";
import { retrieveRelevantContext } from "./retriever";
import { buildDoctorContext } from "./context-builder";
import {
  evidenceRequestSatisfied,
  collectPresentEvidenceTokens,
} from "./evidence-aliases";
import {
  diagnoseFinancials,
  composeFinancialAnswer,
  MIN_PRIMARY_INVESTIGATION_CONFIDENCE,
} from "./financial-diagnosis";
import { runDoctorCycleInMemory } from "./conversation/engine";
import { selectNextInvestigationTemplate } from "./conversation/workflow";

function financialWorkbookEvidence(
  overrides?: Partial<Evidence>,
): Evidence {
  return {
    id: "ev-fin-workbook-1",
    sourceSystem: "Manual Upload",
    sourceType: "financial",
    title: "Q2 Financial Model.xlsx",
    contentSummary: "Workbook with cash, burn, runway, and revenue metrics",
    extractedFacts: {
      revenue: 1_200_000,
      revenueGrowth: 0.08,
      grossMargin: 0.72,
      ebitda: 120_000,
      cashBalance: 2_400_000,
      burnRateMonthly: 180_000,
      cashRunwayMonths: 13,
      revenueWorksheet: "P&L",
      revenuePeriod: "2026-Q2",
      cashRunwayMonthsWorksheet: "Cash",
      cashRunwayMonthsPeriod: "2026-06",
      financialMetricCount: 7,
      financialFactsComplete: false,
    },
    dimensionIds: ["dim-financial"],
    dimensionId: "dim-financial",
    dimension: "Financial",
    occurredAt: "2026-06-30",
    collectedAt: "2026-07-01",
    reliability: 90,
    metadata: { evidenceType: "financial", documentId: "doc-fin-1" },
    citation: { label: "Q2 Financial Model.xlsx" },
    findingIds: [],
    linkedRiskIds: [],
    ...overrides,
  };
}

function financialSnapshot(
  evidence: Evidence = financialWorkbookEvidence(),
  extras?: Partial<CompanyHealthSnapshot>,
): CompanyHealthSnapshot {
  return {
    ...companySnapshot,
    company: {
      ...companySnapshot.company,
      id: "tenant-fin-1",
      name: "FinCo",
    },
    assessmentSnapshotId: "snap-fin-1",
    findings: [],
    risks: [],
    recommendations: [],
    evidence: [evidence],
    dimensions: companySnapshot.dimensions.map((d) =>
      d.id === "dim-financial"
        ? { ...d, score: 78, status: "stable" as const, evidenceIds: [evidence.id] }
        : d,
    ),
    healthScore: {
      ...companySnapshot.healthScore,
      scoreAvailable: true,
      score: 74,
      status: "stable",
      confidence: 70,
    },
    questionAnswers: [],
    businessConcepts: [],
    ...extras,
  };
}

describe("Doctor financial facts retrieval", () => {
  it("answers biggest risk from financial workbook facts without findings", async () => {
    const snapshot = financialSnapshot(
      financialWorkbookEvidence({
        extractedFacts: {
          ...financialWorkbookEvidence().extractedFacts,
          cashRunwayMonths: 4,
          cashRunwayMonthsWorksheet: "Cash",
          cashRunwayMonthsPeriod: "2026-06",
        },
      }),
    );

    const result = await askDoctor(
      { question: "What is my biggest risk?", companyId: snapshot.company.id },
      { snapshot },
    );

    expect(result.answer.insufficientEvidence).toBe(false);
    expect(result.answer.answer.toLowerCase()).not.toMatch(
      /insufficient evidence/,
    );
    expect(result.answer.answer.toLowerCase()).toMatch(/runway|cash/);
    expect(result.answer.evidenceCitations.some((c) => c.id === "ev-fin-workbook-1")).toBe(
      true,
    );
    expect(result.answer.answer).toContain("ev-fin-workbook-1");
    expect(result.answer.answer.toLowerCase()).toMatch(/cash|sheet/);
  });

  it("does not ask for runway when cashRunwayMonths exists on financial workbook", () => {
    const snapshot = financialSnapshot();
    const present = collectPresentEvidenceTokens(snapshot);
    expect(
      evidenceRequestSatisfied(
        ["cash_runway", "financial_statements"],
        present,
        snapshot.evidence,
      ),
    ).toBe(true);

    const home = runDoctorCycleInMemory({
      snapshot,
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.requestedEvidence).toHaveLength(0);
    expect(home.mentorMessage.toLowerCase()).not.toMatch(
      /upload.*cash\s*\/\s*burn|upload a cash/,
    );
  });

  it("frames low-confidence hypotheses as possible issues, not confirmed problems", () => {
    const snapshot = financialSnapshot(
      financialWorkbookEvidence({
        extractedFacts: {
          revenue: 500_000,
          // No runway / growth signal — thin facts
          revenueWorksheet: "P&L",
        },
      }),
    );
    // Force a governance-style investigation path by clearing financial demotion
    // via stage Idea + empty completed — select may return null or non-runway.
    const template = selectNextInvestigationTemplate({
      goal: "run-the-company",
      stage: "Idea",
      snapshot,
      completedTemplateIds: [],
    });
    // With healthy-ish thin financials, runway must not be forced as primary.
    expect(template?.id).not.toBe("inv-runway-shortening");

    const composed = composeFinancialAnswer({
      companyName: "FinCo",
      question: "What is my biggest risk?",
      diagnosis: diagnoseFinancials(snapshot),
    });
    expect(composed.answer).toMatch(/did not identify a high-confidence critical issue/i);
    expect(composed.confidence).toBeGreaterThanOrEqual(
      MIN_PRIMARY_INVESTIGATION_CONFIDENCE,
    );
  });

  it("cites source workbook and sheet from structured facts", () => {
    const snapshot = financialSnapshot();
    const diagnosis = diagnoseFinancials(snapshot, {
      snapshotId: "snap-fin-1",
    });
    expect(diagnosis.facts.some((f) => f.worksheet === "Cash")).toBe(true);
    const composed = composeFinancialAnswer({
      companyName: "FinCo",
      question: "Is runway shortening?",
      diagnosis,
    });
    expect(composed.answer).toContain("Q2 Financial Model.xlsx");
    expect(composed.answer.toLowerCase()).toMatch(/sheet cash|cash/);
    expect(composed.evidenceIds).toContain("ev-fin-workbook-1");
    expect(diagnosis.snapshotId).toBe("snap-fin-1");
  });

  it("retrieves structured facts without requiring findings", () => {
    const snapshot = financialSnapshot();
    const query = classifyQuery("Is runway shortening?");
    expect(query.intent).toBe("financial");
    const retrieval = retrieveRelevantContext(snapshot, query);
    expect(retrieval.structuredFacts.length).toBeGreaterThan(0);
    expect(retrieval.insufficientEvidence).toBe(false);
    expect(retrieval.findings).toHaveLength(0);
    expect(retrieval.snapshotId).toBe("snap-fin-1");

    const context = buildDoctorContext(snapshot, query, retrieval);
    expect(context.structuredFacts.length).toBeGreaterThan(0);
    expect(context.snapshotId).toBe("snap-fin-1");
  });

  it("keeps one-snapshot consistency via assessmentSnapshotId", async () => {
    const snapshot = financialSnapshot(undefined, {
      assessmentSnapshotId: "snap-only-1",
      // Stale-looking risk that must not mix if we only use pack facts —
      // here risks are empty; snapshot id must flow through.
      risks: [],
    });
    const query = classifyQuery("What is my biggest risk?");
    const retrieval = retrieveRelevantContext(snapshot, query);
    expect(retrieval.snapshotId).toBe("snap-only-1");
    const result = await askDoctor(
      { question: "What is my biggest risk?", companyId: "tenant-fin-1" },
      { snapshot },
    );
    expect(result.answer.insufficientEvidence).toBe(false);
  });

  it("tenant isolation: answers only cite tenant workbook evidence", async () => {
    const snapshot = financialSnapshot();
    const result = await askDoctor(
      {
        question: "What needs fixing?",
        companyId: "tenant-fin-1",
      },
      { snapshot },
    );
    expect(result.answer.insufficientEvidence).toBe(false);
    expect(
      result.answer.evidenceCitations.every((c) =>
        snapshot.evidence.some((e) => e.id === c.id),
      ),
    ).toBe(true);
    expect(result.answer.evidenceCitations.some((c) => c.id === "ev-fin-workbook-1")).toBe(
      true,
    );
  });
});
