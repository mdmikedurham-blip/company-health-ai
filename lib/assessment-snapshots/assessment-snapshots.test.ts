import { describe, expect, it } from "vitest";
import {
  assertSnapshotImmutable,
  buildAssessmentSnapshotPack,
  diffAssessmentSnapshots,
  publishAssessmentSnapshot,
  validateAssessmentSnapshotPack,
} from "@/lib/assessment-snapshots";
import type { AssessmentSnapshotRecord } from "@/lib/domain/assessment-snapshot";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
} from "@/lib/domain";

const EMPTY_HEALTH: HealthScore = {
  score: 72,
  scoreAvailable: true,
  status: "watch",
  change: 0,
  changeLabel: "n/a",
  lastUpdated: "2026-07-09",
  confidence: 80,
};

const EMPTY_SCORE_CHANGE: ScoreChangeExplanation = {
  previousScore: 70,
  currentScore: 72,
  change: 2,
  hasPriorSnapshot: true,
  period: "Current",
  summary: "up",
  drivers: [],
};

function dim(id: string, score: number): HealthDimension {
  return {
    id,
    name: id,
    score,
    scored: true,
    status: "watch",
    trend: "flat",
    trendValue: "0",
    weight: 0.1,
    confidence: 80,
    summary: "ok",
    owner: "",
    whyItMatters: "",
    recommendedActions: [],
    applicable: true,
  } as HealthDimension;
}

function finding(id: string): Finding {
  return {
    id,
    title: id,
    description: id,
    dimensionId: "dim-financial",
    dimension: "Financial",
    insightIds: [],
    evidenceIds: ["ev-1"],
    direction: "negative",
    materiality: 7,
    confidence: 80,
    scoreImpact: -5,
    summary: id,
    extractedAt: "now",
    sourceSystem: "test",
  };
}

function risk(id: string, findingId: string): Risk {
  return {
    id,
    title: id,
    summary: id,
    dimensionId: "dim-financial",
    dimension: "Financial",
    severity: "medium",
    status: "open",
    confidence: 80,
    evidenceIds: ["ev-1"],
    findingIds: [findingId],
    estimatedScoreImpact: 5,
    recommendationId: "rec-x",
  } as Risk;
}

function rec(id: string): Recommendation {
  return {
    id,
    title: id,
    description: id,
    dimensionId: "dim-financial",
    dimension: "Financial",
    riskIds: [],
    evidenceIds: ["ev-1"],
    priority: "medium",
    effort: "medium",
    confidence: 70,
    estimatedScoreImprovement: 5,
    rationale: id,
    nextSteps: [],
    priorityScore: 5,
    findingIds: [],
  };
}

type Store = {
  companies: Map<string, { current_snapshot_id: string | null }>;
  snapshots: Map<string, Record<string, unknown>>;
  findings: Map<string, Finding[]>;
  risks: Map<string, Risk[]>;
  recommendations: Map<string, Recommendation[]>;
  healthScores: unknown[];
  questionAnswers: unknown[];
  concepts: unknown[];
  failOn?: "findings" | "publish_update" | null;
};

function createMockClient(store: Store): AppSupabaseClient {
  return {
    from(table: string) {
      if (table === "companies") {
        return {
          select: () => ({
            eq: (_c: string, companyId: string) => ({
              maybeSingle: async () => ({
                data: store.companies.get(companyId) ?? {
                  current_snapshot_id: null,
                },
                error: null,
              }),
            }),
          }),
          update: (patch: { current_snapshot_id: string | null }) => ({
            eq: async (_c: string, companyId: string) => {
              const row = store.companies.get(companyId) ?? {
                current_snapshot_id: null,
              };
              store.companies.set(companyId, {
                ...row,
                current_snapshot_id: patch.current_snapshot_id,
              });
              return { error: null };
            },
          }),
        };
      }
      if (table === "analysis_snapshots") {
        return {
          insert: async (row: Record<string, unknown>) => {
            store.snapshots.set(String(row.id), { ...row });
            return { error: null };
          },
          update: (patch: Record<string, unknown>) => ({
            eq: async (_c: string, id: string) => {
              if (store.failOn === "publish_update" && patch.publish_kind === "published") {
                return { error: { message: "forced publish failure" } };
              }
              const existing = store.snapshots.get(id) ?? {};
              store.snapshots.set(id, { ...existing, ...patch });
              return { error: null };
            },
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              in: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "findings") {
        return {
          delete: () => ({
            eq: async () => {
              if (store.failOn === "findings") {
                return { error: { message: "forced findings failure" } };
              }
              return { error: null };
            },
          }),
          insert: async (rows: Finding[]) => {
            store.findings.set("x", rows);
            return { error: null };
          },
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "risks") {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async (rows: Risk[]) => {
            store.risks.set("x", rows);
            return { error: null };
          },
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "recommendations") {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async (rows: Recommendation[]) => {
            store.recommendations.set("x", rows);
            return { error: null };
          },
        };
      }
      if (table === "health_scores") {
        return {
          insert: async (row: unknown) => {
            store.healthScores.push(row);
            return { error: null };
          },
        };
      }
      if (table === "question_answers") {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async (rows: unknown[]) => {
            store.questionAnswers = rows;
            return { error: null };
          },
        };
      }
      if (table === "company_business_concepts") {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async (rows: unknown[]) => {
            store.concepts = rows;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("assessment snapshot pack", () => {
  it("builds and validates a pack with one snapshot id", () => {
    const pack = buildAssessmentSnapshotPack({
      snapshotId: "snap-1",
      companyId: "co-a",
      assessmentGoal: "run-the-company",
      companyStage: "Growth",
      healthScore: EMPTY_HEALTH,
      dimensions: [dim("dim-financial", 72)],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-runway")],
      risks: [risk("risk-runway", "finding-runway")],
      recommendations: [rec("rec-extend-runway")],
      questionAnswers: [
        {
          questionId: "q-fin-runway-sufficient",
          companyId: "co-a",
          state: "CONTRADICTED",
          confidence: 80,
          supportingEvidenceIds: ["ev-1"],
          missingEvidence: [],
          reasoning: "short runway",
          lastUpdated: "2026-07-09",
          snapshotId: "snap-1",
          stageLevel: "required",
          effectiveImportance: 4,
        },
      ],
      evidenceIds: ["ev-1"],
      documentIds: ["doc-1"],
    });
    expect(validateAssessmentSnapshotPack(pack)).toEqual({ ok: true });
    expect(pack.snapshotId).toBe("snap-1");
    expect(pack.overallHealthAvailable).toBe(true);
  });

  it("rejects mixed snapshot objects", () => {
    const pack = buildAssessmentSnapshotPack({
      snapshotId: "snap-1",
      companyId: "co-a",
      healthScore: EMPTY_HEALTH,
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [],
      risks: [],
      recommendations: [],
      questionAnswers: [
        {
          questionId: "q-x",
          companyId: "co-a",
          state: "UNKNOWN",
          confidence: 0,
          supportingEvidenceIds: [],
          missingEvidence: [],
          reasoning: "",
          lastUpdated: "t",
          snapshotId: "snap-OTHER",
          stageLevel: "optional",
          effectiveImportance: 1,
        },
      ],
      evidenceIds: [],
    });
    const result = validateAssessmentSnapshotPack(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("foreign snapshot"))).toBe(
        true,
      );
    }
  });
});

describe("historical comparison", () => {
  it("diffs findings, risks, scores, coverage, and evidence", () => {
    const previous = buildAssessmentSnapshotPack({
      snapshotId: "snap-prev",
      companyId: "co-a",
      healthScore: { ...EMPTY_HEALTH, score: 70 },
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-old"), finding("finding-keep")],
      risks: [risk("risk-old", "finding-old")],
      recommendations: [rec("rec-old")],
      evidenceIds: ["ev-1", "ev-old"],
    });
    previous.coverageRatio = 0.4;
    previous.confidence = 70;

    const current = buildAssessmentSnapshotPack({
      snapshotId: "snap-cur",
      companyId: "co-a",
      healthScore: { ...EMPTY_HEALTH, score: 75 },
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-keep"), finding("finding-new")],
      risks: [risk("risk-new", "finding-new")],
      recommendations: [rec("rec-new")],
      evidenceIds: ["ev-1", "ev-new"],
    });
    current.coverageRatio = 0.6;
    current.confidence = 85;

    const diff = diffAssessmentSnapshots({ current, previous });
    expect(diff.newFindingIds).toEqual(["finding-new"]);
    expect(diff.resolvedFindingIds).toEqual(["finding-old"]);
    expect(diff.newRiskIds).toEqual(["risk-new"]);
    expect(diff.resolvedRiskIds).toEqual(["risk-old"]);
    expect(diff.recommendationAddedIds).toEqual(["rec-new"]);
    expect(diff.recommendationRemovedIds).toEqual(["rec-old"]);
    expect(diff.scoreMovement.delta).toBe(5);
    expect(diff.coverageMovement.delta).toBe(0.2);
    expect(diff.newEvidenceIds).toEqual(["ev-new"]);
    expect(diff.removedEvidenceIds).toEqual(["ev-old"]);
  });
});

describe("publish lifecycle", () => {
  it("publishes one current snapshot and supersedes the previous", async () => {
    const store: Store = {
      companies: new Map([["co-a", { current_snapshot_id: "snap-old" }]]),
      snapshots: new Map([
        [
          "snap-old",
          {
            id: "snap-old",
            company_id: "co-a",
            publish_kind: "published",
            status: "completed",
          },
        ],
      ]),
      findings: new Map(),
      risks: new Map(),
      recommendations: new Map(),
      healthScores: [],
      questionAnswers: [],
      concepts: [],
    };
    const client = createMockClient(store);
    const result = await publishAssessmentSnapshot({
      client,
      companyId: "co-a",
      assessmentGoal: "run-the-company",
      companyStage: "Growth",
      healthScore: EMPTY_HEALTH,
      dimensions: [dim("dim-financial", 72)],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-runway")],
      risks: [risk("risk-runway", "finding-runway")],
      recommendations: [rec("rec-extend-runway")],
      evidenceIds: ["ev-1"],
      documentIds: ["doc-1"],
      syncCurrentTables: true,
    });

    expect(result.published).toBe(true);
    expect(result.previousSnapshotId).toBe("snap-old");
    expect(store.companies.get("co-a")?.current_snapshot_id).toBe(
      result.snapshotId,
    );
    expect(store.snapshots.get(result.snapshotId)?.publish_kind).toBe(
      "published",
    );
    expect(store.snapshots.get("snap-old")?.publish_kind).toBe("superseded");
    expect(store.snapshots.get("snap-old")?.superseded_by).toBe(
      result.snapshotId,
    );
  });

  it("rolls back current pointer when sync fails", async () => {
    const store: Store = {
      companies: new Map([["co-a", { current_snapshot_id: "snap-old" }]]),
      snapshots: new Map(),
      findings: new Map(),
      risks: new Map(),
      recommendations: new Map(),
      healthScores: [],
      questionAnswers: [],
      concepts: [],
      failOn: "findings",
    };
    const client = createMockClient(store);
    await expect(
      publishAssessmentSnapshot({
        client,
        companyId: "co-a",
        healthScore: EMPTY_HEALTH,
        dimensions: [],
        scoreChange: EMPTY_SCORE_CHANGE,
        findings: [finding("finding-runway")],
        risks: [],
        recommendations: [],
        evidenceIds: [],
        syncCurrentTables: true,
      }),
    ).rejects.toThrow(/rollback/);

    expect(store.companies.get("co-a")?.current_snapshot_id).toBe("snap-old");
  });

  it("treats published snapshots as immutable", () => {
    const record: AssessmentSnapshotRecord = {
      snapshotId: "snap-1",
      companyId: "co-a",
      publishKind: "published",
      status: "completed",
      assessmentGoal: "run-the-company",
      companyStage: "Growth",
      createdAt: "t",
      publishedAt: "t",
      analysisVersion: "v1",
      extractionVersion: "v1",
      evidenceVersion: "v1",
      documentVersions: [],
      generatedBy: "test",
      confidence: 80,
      coverageRatio: 0.5,
      overallHealthAvailable: true,
      parentSnapshotId: null,
      supersededBy: null,
      pack: null,
    };
    expect(() => assertSnapshotImmutable(record)).toThrow(/immutable/);
  });
});

describe("tenant isolation", () => {
  it("scopes packs to companyId", () => {
    const a = buildAssessmentSnapshotPack({
      snapshotId: "snap-a",
      companyId: "co-a",
      healthScore: EMPTY_HEALTH,
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [],
      risks: [],
      recommendations: [],
      evidenceIds: ["ev-a"],
    });
    const b = buildAssessmentSnapshotPack({
      snapshotId: "snap-b",
      companyId: "co-b",
      healthScore: EMPTY_HEALTH,
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [],
      risks: [],
      recommendations: [],
      evidenceIds: ["ev-b"],
    });
    expect(a.companyId).not.toBe(b.companyId);
    expect(a.evidenceIds).not.toEqual(b.evidenceIds);
  });
});

describe("reprocessing creates a new snapshot", () => {
  it("second publish yields a new snapshot id while retaining prior pack", async () => {
    const store: Store = {
      companies: new Map([["co-a", { current_snapshot_id: null }]]),
      snapshots: new Map(),
      findings: new Map(),
      risks: new Map(),
      recommendations: new Map(),
      healthScores: [],
      questionAnswers: [],
      concepts: [],
    };
    const client = createMockClient(store);
    const first = await publishAssessmentSnapshot({
      client,
      companyId: "co-a",
      healthScore: EMPTY_HEALTH,
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-1")],
      risks: [],
      recommendations: [],
      evidenceIds: ["ev-1"],
      syncCurrentTables: false,
    });
    store.companies.set("co-a", {
      current_snapshot_id: first.snapshotId,
    });
    const second = await publishAssessmentSnapshot({
      client,
      companyId: "co-a",
      healthScore: { ...EMPTY_HEALTH, score: 80 },
      dimensions: [],
      scoreChange: EMPTY_SCORE_CHANGE,
      findings: [finding("finding-2")],
      risks: [],
      recommendations: [],
      evidenceIds: ["ev-1", "ev-2"],
      syncCurrentTables: false,
    });
    expect(second.snapshotId).not.toBe(first.snapshotId);
    expect(store.snapshots.has(first.snapshotId)).toBe(true);
    expect(store.snapshots.get(first.snapshotId)?.publish_kind).toBe(
      "superseded",
    );
    expect(store.companies.get("co-a")?.current_snapshot_id).toBe(
      second.snapshotId,
    );
  });
});
