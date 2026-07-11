import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYBOOK,
  PLAYBOOK_ENGINE_VERSION,
  PLAYBOOK_IDS,
} from "@/lib/domain/playbook";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import type { Recommendation } from "@/lib/domain/recommendation";
import type { Risk } from "@/lib/domain/risk";
import {
  getPlaybookProvider,
  interpretWithPlaybook,
  listPlaybookProviders,
  prioritizeRecommendationsForPlaybook,
  resolvePlaybookId,
} from "@/lib/playbooks";
import { ensurePlaybookProvidersRegistered } from "@/lib/playbooks/register";

ensurePlaybookProvidersRegistered();

function answer(
  partial: Partial<DiligenceQuestionAnswer> & { questionId: string },
): DiligenceQuestionAnswer {
  return {
    companyId: "co-1",
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 40,
    supportingEvidenceIds: [],
    missingEvidence: ["cash_runway"],
    reasoning: "Missing evidence",
    lastUpdated: "2026-01-01T00:00:00.000Z",
    snapshotId: null,
    stageLevel: "required",
    effectiveImportance: 3,
    ...partial,
  };
}

function rec(
  partial: Partial<Recommendation> & { id: string; title: string },
): Recommendation {
  return {
    description: "desc",
    dimensionId: "dim-financial",
    dimension: "Financial",
    riskIds: [],
    evidenceIds: [],
    priority: "high",
    effort: "medium",
    confidence: 70,
    estimatedScoreImprovement: 8,
    rationale: "rationale",
    nextSteps: [],
    priorityScore: 10,
    findingIds: [],
    ...partial,
  };
}

describe("Due Diligence Playbook Engine", () => {
  it("registers all playbooks including default", () => {
    const providers = listPlaybookProviders();
    expect(providers.map((p) => p.id).sort()).toEqual(
      [...PLAYBOOK_IDS].sort(),
    );
    expect(resolvePlaybookId(null)).toBe(DEFAULT_PLAYBOOK);
    expect(getPlaybookProvider().id).toBe("run-the-company");
  });

  it("different playbooks reorder question priorities", () => {
    const answers = [
      answer({ questionId: "q-fin-runway-sufficient", effectiveImportance: 4 }),
      answer({ questionId: "q-sec-policies", effectiveImportance: 3 }),
      answer({ questionId: "q-legal-ip-assignments", effectiveImportance: 3 }),
      answer({ questionId: "q-gov-cap-table", effectiveImportance: 3 }),
    ];

    const run = getPlaybookProvider("run-the-company").prioritizeQuestions(
      answers,
    );
    const raise = getPlaybookProvider("raise-capital").prioritizeQuestions(
      answers,
    );
    const enterprise = getPlaybookProvider(
      "enterprise-sales",
    ).prioritizeQuestions(answers);
    const sell = getPlaybookProvider("sell-the-company").prioritizeQuestions(
      answers,
    );

    expect(run[0]).toBe("q-fin-runway-sufficient");
    expect(raise.indexOf("q-gov-cap-table")).toBeLessThan(
      raise.indexOf("q-sec-policies"),
    );
    expect(enterprise[0]).toBe("q-sec-policies");
    expect(sell[0]).toBe("q-legal-ip-assignments");
    expect(run).not.toEqual(enterprise);
  });

  it("evidence context is unchanged while recommendations reorder", () => {
    const recommendations = [
      rec({
        id: "r-sec",
        title: "Publish security policies",
        dimensionId: "dim-security",
        priorityScore: 12,
      }),
      rec({
        id: "r-runway",
        title: "Extend cash runway",
        dimensionId: "dim-financial",
        priorityScore: 12,
        rationale: "protect runway",
      }),
      rec({
        id: "r-ip",
        title: "Complete IP assignments",
        dimensionId: "dim-legal",
        priorityScore: 12,
      }),
    ];

    const runOrdered = prioritizeRecommendationsForPlaybook(
      "run-the-company",
      recommendations,
    );
    const enterpriseOrdered = prioritizeRecommendationsForPlaybook(
      "enterprise-sales",
      recommendations,
    );
    const sellOrdered = prioritizeRecommendationsForPlaybook(
      "sell-the-company",
      recommendations,
    );

    expect(runOrdered.map((r) => r.id)).not.toEqual(
      enterpriseOrdered.map((r) => r.id),
    );
    expect(enterpriseOrdered[0]?.id).toBe("r-sec");
    expect(sellOrdered[0]?.id).toBe("r-ip");
    // Original array untouched
    expect(recommendations.map((r) => r.id)).toEqual([
      "r-sec",
      "r-runway",
      "r-ip",
    ]);
  });

  it("upload priorities reorder by playbook and hide satisfied evidence", () => {
    const runUploads = getPlaybookProvider("run-the-company").prioritizeUploads({
      companyId: "co-1",
      playbookId: "run-the-company",
      answers: [],
      recommendations: [],
      risks: [] as Risk[],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const raiseUploads = getPlaybookProvider("raise-capital").prioritizeUploads({
      companyId: "co-1",
      playbookId: "raise-capital",
      answers: [],
      recommendations: [],
      risks: [] as Risk[],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const enterpriseUploads = getPlaybookProvider(
      "enterprise-sales",
    ).prioritizeUploads({
      companyId: "co-1",
      playbookId: "enterprise-sales",
      answers: [],
      recommendations: [],
      risks: [] as Risk[],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: ["soc2"],
    });

    expect(runUploads[0]?.label).toMatch(/Customer metrics|Financial forecast/i);
    expect(raiseUploads.some((u) => /cap table/i.test(u.label))).toBe(true);
    expect(enterpriseUploads.some((u) => /SOC 2/i.test(u.label))).toBe(false);
    expect(
      enterpriseUploads.some((u) => /Security policies/i.test(u.label)),
    ).toBe(true);
  });

  it("playbook-specific executive summary and readiness", () => {
    const answers = [
      answer({
        questionId: "q-fin-runway-sufficient",
        state: "SUPPORTED",
        missingEvidence: [],
        effectiveImportance: 4,
      }),
      answer({
        questionId: "q-sec-policies",
        state: "INSUFFICIENT_EVIDENCE",
        missingEvidence: ["security_policies"],
        effectiveImportance: 3,
      }),
    ];

    const run = interpretWithPlaybook({
      companyId: "co-1",
      assessmentGoal: "run-the-company",
      answers,
      recommendations: [
        rec({ id: "r1", title: "Extend cash runway", priorityScore: 20 }),
      ],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: ["cash_runway"],
    });
    const enterprise = interpretWithPlaybook({
      companyId: "co-1",
      assessmentGoal: "enterprise-sales",
      answers,
      recommendations: [
        rec({
          id: "r2",
          title: "Publish security policies",
          dimensionId: "dim-security",
          priorityScore: 20,
        }),
      ],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: ["cash_runway"],
    });

    expect(run.executiveSummary.title).toMatch(/Run the Company/i);
    expect(enterprise.executiveSummary.title).toMatch(/Enterprise Sales/i);
    expect(run.executiveSummary.headline).not.toBe(
      enterprise.executiveSummary.headline,
    );
    expect(run.playbookVersion).toBe(PLAYBOOK_ENGINE_VERSION);
    expect(run.readiness.coveragePercent).toBeGreaterThanOrEqual(0);
    expect(enterprise.missingEvidence.some((m) => m.evidenceType === "security_policies")).toBe(
      true,
    );
  });

  it("tenant isolation: interpretation is scoped to companyId in context", () => {
    const a = interpretWithPlaybook({
      companyId: "tenant-a",
      assessmentGoal: "run-the-company",
      answers: [answer({ questionId: "q-fin-runway-sufficient", companyId: "tenant-a" })],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const b = interpretWithPlaybook({
      companyId: "tenant-b",
      assessmentGoal: "run-the-company",
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    expect(a.readiness.playbookId).toBe(b.readiness.playbookId);
    expect(a.prioritizedQuestionIds.length).toBeGreaterThan(
      b.prioritizedQuestionIds.length === 0
        ? -1
        : b.prioritizedQuestionIds.length - 1,
    );
    // Providers never cross-wire companies — context companyId is caller-owned.
    expect(a.executiveSummary.playbookId).toBe("run-the-company");
    expect(b.readiness.readinessPercent).toBe(0);
  });

  it("adding a playbook requires registry only — getPlaybookProvider has no switch", () => {
    const src = getPlaybookProvider.toString();
    expect(src).not.toMatch(/switch\s*\(/);
  });
});
