import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYBOOK,
  PLAYBOOK_ENGINE_VERSION,
  PLAYBOOK_IDS,
} from "@/lib/domain/playbook";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import type { QuestionCoverageReport } from "@/lib/domain/diligence-question";
import type { Recommendation } from "@/lib/domain/recommendation";
import type { Risk } from "@/lib/domain/risk";
import type { AssessmentSnapshotPack } from "@/lib/domain/assessment-snapshot";
import {
  getPlaybookProvider,
  interpretSnapshotWithPlaybook,
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
    snapshotId: "snap-1",
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

function emptyPack(
  overrides: Partial<AssessmentSnapshotPack> = {},
): AssessmentSnapshotPack {
  return {
    schemaVersion: "assessment-snapshot-pack-v1",
    snapshotId: "snap-1",
    companyId: "co-1",
    assessmentGoal: "run-the-company",
    playbookVersion: PLAYBOOK_ENGINE_VERSION,
    companyStage: "Growth",
    createdAt: "2026-01-01T00:00:00.000Z",
    analysisVersion: "analysis-v1",
    extractionVersion: "extract-v1",
    evidenceVersion: "evidence-v1",
    documentVersions: [],
    status: "completed",
    generatedBy: "test",
    confidence: 50,
    coverageRatio: 0.5,
    overallHealthAvailable: true,
    healthScore: {
      score: 70,
      status: "watch",
      change: 0,
      changeLabel: "",
      lastUpdated: "2026-01-01T00:00:00.000Z",
      confidence: 50,
    },
    dimensions: [],
    scoreChange: {
      hasPriorSnapshot: false,
      previousScore: 70,
      currentScore: 70,
      change: 0,
      period: "n/a",
      summary: "",
      drivers: [],
    },
    findings: [],
    risks: [],
    recommendations: [
      rec({ id: "r-sec", title: "Publish security policies", dimensionId: "dim-security" }),
      rec({ id: "r-runway", title: "Extend cash runway", rationale: "protect runway" }),
      rec({ id: "r-ip", title: "Complete IP assignments", dimensionId: "dim-legal" }),
    ],
    questionAnswers: [
      answer({ questionId: "q-fin-runway-sufficient", effectiveImportance: 4 }),
      answer({ questionId: "q-sec-policies", effectiveImportance: 3 }),
      answer({ questionId: "q-legal-ip-assignments", effectiveImportance: 3 }),
    ],
    questionCoverage: null,
    businessConcepts: [],
    evidenceIds: ["ev-1"],
    documentIds: ["doc-1"],
    provenance: { parentSnapshotId: null, priorSnapshotId: null },
    ...overrides,
  };
}

describe("Due Diligence Playbook Engine", () => {
  it("default playbook is Run the Company", () => {
    expect(resolvePlaybookId(null)).toBe(DEFAULT_PLAYBOOK);
    expect(getPlaybookProvider().id).toBe("run-the-company");
    expect(getPlaybookProvider().name).toBe("Run the Company");
    expect(listPlaybookProviders().map((p) => p.id).sort()).toEqual(
      [...PLAYBOOK_IDS].sort(),
    );
  });

  it("changing playbook changes priorities but not evidence", () => {
    const pack = emptyPack();
    const evidenceIds = [...pack.evidenceIds];
    const answers = pack.questionAnswers.map((a) => ({ ...a }));

    const run = interpretSnapshotWithPlaybook({
      companyId: "co-1",
      pack,
      assessmentGoal: "run-the-company",
    });
    const enterprise = interpretSnapshotWithPlaybook({
      companyId: "co-1",
      pack,
      assessmentGoal: "enterprise-sales",
    });

    expect(run.prioritizedQuestionIds).not.toEqual(
      enterprise.prioritizedQuestionIds,
    );
    expect(pack.evidenceIds).toEqual(evidenceIds);
    expect(pack.questionAnswers).toEqual(answers);
    expect(run.provenance.snapshotId).toBe("snap-1");
    expect(enterprise.provenance.snapshotId).toBe("snap-1");
  });

  it("one snapshot only — provenance snapshotId is singular", () => {
    const pack = emptyPack({ snapshotId: "snap-only" });
    const view = interpretSnapshotWithPlaybook({
      companyId: "co-1",
      pack,
      assessmentGoal: "raise-capital",
    });
    expect(view.provenance.snapshotId).toBe("snap-only");
    expect(view.readiness.snapshotId).toBe("snap-only");
    expect(view.executiveSummary.snapshotId).toBe("snap-only");
  });

  it("stage-aware applicability: Idea NA answers are not blockers under Run the Company", () => {
    const view = interpretWithPlaybook({
      companyId: "co-1",
      assessmentGoal: "run-the-company",
      snapshotId: "snap-1",
      companyStage: "Idea",
      answers: [
        answer({
          questionId: "q-gov-cadence",
          state: "INSUFFICIENT_EVIDENCE",
          stageLevel: "not_applicable",
          effectiveImportance: 4,
        }),
        answer({
          questionId: "q-fin-runway-sufficient",
          state: "SUPPORTED",
          missingEvidence: [],
          stageLevel: "optional",
        }),
      ],
      recommendations: [],
      risks: [] as Risk[],
      healthScore: null,
      coverage: {
        companyId: "co-1",
        snapshotId: "snap-1",
        generatedAt: "2026-01-01T00:00:00.000Z",
        applicable: 1,
        answered: 1,
        supported: 1,
        contradicted: 0,
        insufficientEvidence: 0,
        notApplicable: 1,
        unknown: 0,
        lackingEvidence: 0,
        coverageRatio: 1,
        meanConfidence: 80,
        byDimension: {} as QuestionCoverageReport["byDimension"],
      },
      presentEvidenceTypes: ["cash_runway"],
    });

    expect(
      view.criticalBlockers.some((b) => b.startsWith("q-gov-cadence")),
    ).toBe(false);
  });

  it("readiness hidden when coverage is insufficient", () => {
    const provider = getPlaybookProvider("ipo-readiness");
    expect(provider.minCoveragePercent).toBeGreaterThan(0);

    const view = interpretWithPlaybook({
      companyId: "co-1",
      assessmentGoal: "ipo-readiness",
      snapshotId: "snap-1",
      companyStage: "Growth",
      answers: [
        answer({
          questionId: "q-ops-financial-controls",
          state: "UNKNOWN",
          stageLevel: "required",
        }),
      ],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: {
        companyId: "co-1",
        snapshotId: "snap-1",
        generatedAt: "2026-01-01T00:00:00.000Z",
        applicable: 10,
        answered: 1,
        supported: 0,
        contradicted: 0,
        insufficientEvidence: 0,
        notApplicable: 0,
        unknown: 1,
        lackingEvidence: 1,
        coverageRatio: 0.1,
        meanConfidence: 20,
        byDimension: {} as QuestionCoverageReport["byDimension"],
      },
      presentEvidenceTypes: [],
    });

    expect(view.readiness.readinessAvailable).toBe(false);
    expect(view.readiness.readinessPercent).toBeNull();
    expect(view.readiness.evidenceCoveragePercent).toBe(10);
  });

  it("upload priorities differ by playbook and include rich metadata", () => {
    const run = getPlaybookProvider("run-the-company").prioritizeUploads({
      companyId: "co-1",
      playbookId: "run-the-company",
      snapshotId: null,
      companyStage: "Growth",
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const raise = getPlaybookProvider("raise-capital").prioritizeUploads({
      companyId: "co-1",
      playbookId: "raise-capital",
      snapshotId: null,
      companyStage: "Growth",
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const enterprise = getPlaybookProvider("enterprise-sales").prioritizeUploads({
      companyId: "co-1",
      playbookId: "enterprise-sales",
      snapshotId: null,
      companyStage: "Growth",
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: ["soc2"],
    });

    expect(run.map((u) => u.label)).not.toEqual(raise.map((u) => u.label));
    expect(raise.some((u) => /cap table/i.test(u.label))).toBe(true);
    expect(run[0]?.evidenceCategory).toBeTruthy();
    expect(run[0]?.questionsItCouldAnswer.length).toBeGreaterThan(0);
    expect(run[0]?.expectedCoverageImpact).toBeGreaterThan(0);
    expect(enterprise.some((u) => /SOC 2/i.test(u.label))).toBe(false);
  });

  it("recommendations reorder correctly by playbook", () => {
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

    const enterprise = prioritizeRecommendationsForPlaybook(
      "enterprise-sales",
      recommendations,
    );
    const sell = prioritizeRecommendationsForPlaybook(
      "sell-the-company",
      recommendations,
    );

    expect(enterprise[0]?.id).toBe("r-sec");
    expect(sell[0]?.id).toBe("r-ip");
    expect(recommendations.map((r) => r.id)).toEqual([
      "r-sec",
      "r-runway",
      "r-ip",
    ]);
  });

  it("tenant isolation: interpretation is scoped to companyId", () => {
    const a = interpretWithPlaybook({
      companyId: "tenant-a",
      assessmentGoal: "run-the-company",
      snapshotId: "snap-a",
      companyStage: "Growth",
      answers: [
        answer({
          questionId: "q-fin-runway-sufficient",
          companyId: "tenant-a",
          snapshotId: "snap-a",
        }),
      ],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    const b = interpretWithPlaybook({
      companyId: "tenant-b",
      assessmentGoal: "run-the-company",
      snapshotId: "snap-b",
      companyStage: "Growth",
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });

    expect(a.provenance.companyId).toBe("tenant-a");
    expect(b.provenance.companyId).toBe("tenant-b");
    expect(a.provenance.snapshotId).not.toBe(b.provenance.snapshotId);
  });

  it("no demo/mock fallback — empty company yields empty interpretation", () => {
    const empty = interpretWithPlaybook({
      companyId: "empty-co",
      assessmentGoal: "run-the-company",
      snapshotId: null,
      companyStage: null,
      answers: [],
      recommendations: [],
      risks: [],
      healthScore: null,
      coverage: null,
      presentEvidenceTypes: [],
    });
    expect(empty.prioritizedRecommendationIds).toEqual([]);
    expect(empty.readiness.topRecommendations).toEqual([]);
    expect(empty.provenance.companyId).toBe("empty-co");
  });

  it("adding a new playbook requires no reasoning-engine changes", () => {
    expect(getPlaybookProvider.toString()).not.toMatch(/switch\s*\(/);
    expect(interpretWithPlaybook.toString()).not.toMatch(/switch\s*\(/);
  });
});
