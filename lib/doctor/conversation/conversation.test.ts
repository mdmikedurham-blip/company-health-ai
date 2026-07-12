import { describe, expect, it } from "vitest";
import { companySnapshot } from "@/lib/data";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import { runDoctorCycleInMemory } from "@/lib/doctor/conversation/engine";
import {
  advanceInvestigation,
  selectNextInvestigationTemplate,
} from "@/lib/doctor/conversation/workflow";
import { DOCTOR_INVESTIGATION_CATALOG } from "@/lib/doctor/investigations/catalog";

describe("Doctor Conversation Engine", () => {
  it("opens one active investigation by default", () => {
    const home = runDoctorCycleInMemory({
      snapshot: companySnapshot,
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.currentInvestigation).not.toBeNull();
    expect(home.currentInvestigation?.status).not.toBe("completed");
    expect(home.mentorMessage.length).toBeGreaterThan(20);
    expect(home.mentorMessage.toLowerCase()).not.toMatch(
      /^upload more documents\.?$/,
    );
  });

  it("is stage-aware — Idea companies skip board minutes investigations", () => {
    const idea = selectNextInvestigationTemplate({
      goal: "run-the-company",
      stage: "Idea",
      snapshot: {
        ...companySnapshot,
        risks: [],
        findings: [],
        evidence: [],
      },
      completedTemplateIds: [],
    });
    expect(idea?.id).not.toBe("inv-board-approvals");
    expect(idea?.id).not.toBe("inv-governance-gaps");

    // Without financial value signals, board-readiness elevates governance/board work.
    const boardPreferred = selectNextInvestigationTemplate({
      goal: "board-readiness",
      stage: "Growth",
      snapshot: {
        ...companySnapshot,
        risks: [],
        findings: [],
        evidence: [],
      },
      completedTemplateIds: [],
    });
    expect(
      boardPreferred?.id === "inv-governance-gaps" ||
        boardPreferred?.id === "inv-board-approvals" ||
        (boardPreferred?.goalWeights["board-readiness"] ?? 0) >= 1.2,
    ).toBe(true);

    // Phase 10: with rich financial evidence, highest expected value creation may
    // outrank board paperwork (e.g. concentration > documentation).
    const growthWithFacts = selectNextInvestigationTemplate({
      goal: "board-readiness",
      stage: "Growth",
      snapshot: companySnapshot,
      completedTemplateIds: [],
    });
    expect(growthWithFacts).not.toBeNull();
  });

  it("assessment goal reprioritizes investigations", () => {
    const run = selectNextInvestigationTemplate({
      goal: "run-the-company",
      stage: "Growth",
      snapshot: {
        ...companySnapshot,
        risks: [],
        findings: [],
        evidence: [],
      },
      completedTemplateIds: [],
    });
    const enterprise = selectNextInvestigationTemplate({
      goal: "enterprise-sales",
      stage: "Growth",
      snapshot: {
        ...companySnapshot,
        risks: [],
        findings: [],
        evidence: [],
      },
      completedTemplateIds: [],
    });
    expect(run?.id).not.toBe(enterprise?.id);
    expect(enterprise?.id).toBe("inv-security-readiness");
  });

  it("does not duplicate evidence requests when cashRunwayMonths is already present", () => {
    const template = DOCTOR_INVESTIGATION_CATALOG.find(
      (t) => t.id === "inv-runway-shortening",
    )!;
    const home = runDoctorCycleInMemory({
      snapshot: {
        ...companySnapshot,
        evidence: companySnapshot.evidence.map((e, idx) =>
          idx === 0
            ? {
                ...e,
                sourceType: "financial",
                metadata: { ...e.metadata, evidenceType: "financial" },
                extractedFacts: {
                  ...e.extractedFacts,
                  cashRunwayMonths: 14,
                  burnRateMonthly: 100_000,
                  cashBalance: 1_400_000,
                },
              }
            : e,
        ),
      },
      goal: DEFAULT_ASSESSMENT_GOAL,
      stage: "Growth",
      completedTemplateIds: [],
      existing: {
        id: "inv-1",
        conversationId: "c1",
        companyId: companySnapshot.company.id,
        templateId: template.id,
        title: template.title,
        businessQuestion: template.businessQuestion,
        hypotheses: template.hypotheses,
        requiredEvidence: template.requiredEvidence,
        confidence: 40,
        blockingUnknowns: [],
        status: "awaiting_evidence",
        priority: 100,
        currentQuestion: template.highValueQuestion,
        evidenceRequest: template.requiredEvidence[0]!,
        recommendation: template.recommendationTemplate,
        explainability: {
          findingIds: [],
          questionIds: [],
          evidenceIds: [],
          documentIds: [],
        },
        snapshotId: null,
        openedAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(home.requestedEvidence).toHaveLength(0);
    expect(home.workflowPhase).toBe("recommend");
    expect(home.recentlyLearned.length).toBeGreaterThan(0);
  });

  it("never requests irrelevant Idea-stage board documents under Run the Company", () => {
    const home = runDoctorCycleInMemory({
      snapshot: {
        ...companySnapshot,
        risks: [],
        findings: [],
        evidence: [],
      },
      goal: "run-the-company",
      stage: "Idea",
    });
    const reqTypes =
      home.requestedEvidence.flatMap((r) => r.evidenceTypes) ?? [];
    expect(reqTypes).not.toContain("board_minutes");
    if (home.currentInvestigation) {
      expect(home.currentInvestigation.templateId).not.toBe(
        "inv-board-approvals",
      );
    }
  });

  it("tenant isolation: home provenance uses snapshot company id", () => {
    const home = runDoctorCycleInMemory({
      snapshot: {
        ...companySnapshot,
        company: { ...companySnapshot.company, id: "tenant-a" },
      },
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.provenance.companyId).toBe("tenant-a");
    expect(home.conversation.companyId).toBe("tenant-a");
  });

  it("asks at most one question and one evidence request at a time", () => {
    const home = runDoctorCycleInMemory({
      snapshot: {
        ...companySnapshot,
        evidence: [],
      },
      goal: "run-the-company",
      stage: "Growth",
    });
    expect(home.conversation.unansweredQuestions.length).toBeLessThanOrEqual(1);
    expect(home.requestedEvidence.length).toBeLessThanOrEqual(1);
  });

  it("advanceInvestigation keeps a single workflow phase", () => {
    const template = DOCTOR_INVESTIGATION_CATALOG[0]!;
    const result = advanceInvestigation({
      investigation: {
        id: "x",
        conversationId: "c",
        companyId: "co",
        templateId: template.id,
        title: template.title,
        businessQuestion: template.businessQuestion,
        hypotheses: template.hypotheses,
        requiredEvidence: template.requiredEvidence,
        confidence: 10,
        blockingUnknowns: [],
        status: "open",
        priority: 1,
        currentQuestion: null,
        evidenceRequest: null,
        recommendation: template.recommendationTemplate,
        explainability: {
          findingIds: [],
          questionIds: [],
          evidenceIds: [],
          documentIds: [],
        },
        snapshotId: null,
        openedAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
      },
      snapshot: { ...companySnapshot, evidence: [] },
    });
    expect(["ask", "request_evidence", "recommend"]).toContain(result.phase);
  });
});
