import { describe, expect, it, vi } from "vitest";
import {
  buildDashboardMetrics,
  emptyTenantDashboard,
  isDemoModeEnabled,
  loadTenantDashboard,
} from "./index";
import { buildAssessmentGoalDashboardContext } from "@/lib/assessment-goals";
import type { Risk, Recommendation } from "@/lib/domain";

describe("dashboard tenant isolation", () => {
  it("evidence remains identical regardless of goal", () => {
    const runCtx = buildAssessmentGoalDashboardContext({
      companyId: "co-e",
      goal: "run-the-company",
      selectedBy: null,
      selectedAt: "2026-01-01T00:00:00.000Z",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    });
    const capitalCtx = buildAssessmentGoalDashboardContext({
      companyId: "co-e",
      goal: "raise-capital",
      selectedBy: null,
      selectedAt: "2026-01-01T00:00:00.000Z",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    });
    const withRun = emptyTenantDashboard({
      companyId: "co-e",
      companyName: "E",
      documentCount: 4,
      assessmentGoal: runCtx,
    });
    const withCapital = emptyTenantDashboard({
      companyId: "co-e",
      companyName: "E",
      documentCount: 4,
      assessmentGoal: capitalCtx,
    });
    expect(withRun.assessmentGoal.goal).not.toBe(withCapital.assessmentGoal.goal);
    expect(withRun.evidenceCatalog).toEqual(withCapital.evidenceCatalog);
    expect(withRun.healthScore).toEqual(withCapital.healthScore);
    expect(withRun.provenance.document_count).toBe(
      withCapital.provenance.document_count,
    );
    expect(withRun.evidenceCoverage).toEqual(withCapital.evidenceCoverage);
  });

  it("empty tenant defaults assessment goal to Run the Company", () => {
    const view = emptyTenantDashboard({
      companyId: "co-new",
      companyName: "New Co",
    });
    expect(view.assessmentGoal.goal).toBe("run-the-company");
    expect(view.assessmentGoal.label).toBe("Run the Company");
    expect(view.assessmentGoal.purpose).toMatch(/operational health/i);
  });

  it("empty tenant shows zero documents and empty_state provenance", () => {
    const view = emptyTenantDashboard({
      companyId: "co-new",
      companyName: "New Co",
    });
    expect(view.provenance.source).toBe("empty_state");
    expect(view.provenance.company_id).toBe("co-new");
    expect(view.provenance.document_count).toBe(0);
    expect(view.provenance.score_method).toBe("none");
    expect(view.provenance.evidence_count).toBe(0);
    expect(view.metrics[0]?.value).toBe("0");
    expect(view.healthScore.score).toBe(0);
    expect(view.healthScore.scoreAvailable).toBe(false);
    expect(view.healthScore.status).toBe("insufficient");
    expect(view.scoreChangeExplanation.hasPriorSnapshot).toBe(false);
    expect(view.topRisks).toEqual([]);
    expect(view.recommendations).toEqual([]);
    expect(view.evidenceCoverage).toBeNull();
  });

  it("dashboard panels reconcile to one snapshot id in provenance", () => {
    const view = emptyTenantDashboard({
      companyId: "co-snap",
      companyName: "Snap Co",
    });
    expect(view.provenance.snapshot_id).toBeNull();
    expect(view.provenance.prior_snapshot_id).toBeNull();
    // Single provenance object feeds score, risks, and actions panels
    expect(view.provenance.company_id).toBe("co-snap");
    expect(view.topRisks).toEqual([]);
    expect(view.nextBestActions).toEqual([]);
    expect(view.healthScore.scoreAvailable).toBe(false);
  });

  it("documents analyzed equals processed document count (not mock 1292)", () => {
    const metrics = buildDashboardMetrics({
      documentCount: 3,
      evidenceCount: 3,
      risks: [],
      recommendations: [],
      confidence: 70,
    });
    expect(metrics[0]?.label).toBe("Documents analyzed");
    expect(metrics[0]?.value).toBe("3");
    expect(metrics[0]?.change).toBe("3 in current assessment");
    expect(metrics[0]?.value).not.toBe("1,292");
  });

  it("DEMO_MODE is off by default in production-like env", () => {
    const prev = process.env.DEMO_MODE;
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    expect(isDemoModeEnabled()).toBe(false);
    if (prev !== undefined) process.env.DEMO_MODE = prev;
  });

  it("tenant A loader never returns tenant B company_id", async () => {
    const docs = new Map([
      ["co-a", { processed: 3 }],
      ["co-b", { processed: 99 }],
    ]);

    function clientFor(companyId: string) {
      return {
        from(table: string) {
          if (table === "documents") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () =>
                      Promise.resolve({
                        count: docs.get(companyId)?.processed ?? 0,
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          if (table === "analysis_snapshots") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: () =>
                          Promise.resolve({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "health_scores") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(table);
        },
      } as never;
    }

    // No snapshot/score → empty for A
    const viewA = await loadTenantDashboard({
      client: clientFor("co-a"),
      companyId: "co-a",
      companyName: "A",
    });
    expect(viewA.provenance.company_id).toBe("co-a");
    expect(viewA.provenance.source).toBe("empty_state");
    expect(viewA.provenance.document_count).toBe(3);

    const viewB = await loadTenantDashboard({
      client: clientFor("co-b"),
      companyId: "co-b",
      companyName: "B",
    });
    expect(viewB.provenance.company_id).toBe("co-b");
    expect(viewB.provenance.document_count).toBe(99);
    expect(viewA.provenance.company_id).not.toBe(viewB.provenance.company_id);
  });

  it("persisted path metrics reconcile to provided risks/actions counts", () => {
    const risks = [
      { id: "r1", severity: "high", priorityScore: 1 },
      { id: "r2", severity: "low", priorityScore: 1 },
    ] as unknown as Risk[];
    const recommendations = [
      { id: "a1", priority: "high", priorityScore: 10 },
    ] as unknown as Recommendation[];
    const metrics = buildDashboardMetrics({
      documentCount: 10,
      evidenceCount: 8,
      risks,
      recommendations,
      confidence: 82,
    });
    expect(metrics.find((m) => m.label === "Documents analyzed")?.value).toBe(
      "10",
    );
    expect(metrics.find((m) => m.label === "Active risks")?.value).toBe("2");
    expect(metrics.find((m) => m.label === "Open actions")?.value).toBe("1");
    expect(metrics.find((m) => m.label === "Confidence score")?.value).toBe(
      "82%",
    );
  });

  it("deleting processed docs reduces documents analyzed metric", () => {
    const before = buildDashboardMetrics({
      documentCount: 10,
      evidenceCount: 10,
      risks: [],
      recommendations: [],
      confidence: 70,
    });
    const after = buildDashboardMetrics({
      documentCount: 9,
      evidenceCount: 9,
      risks: [],
      recommendations: [],
      confidence: 70,
    });
    expect(before[0]?.value).toBe("10");
    expect(after[0]?.value).toBe("9");
  });
});

describe("no mock fallback in production loader", () => {
  it("emptyTenantDashboard does not import Acme document counts", async () => {
    const view = emptyTenantDashboard({
      companyId: "uuid-peachjar",
      companyName: "Peachjar",
    });
    expect(view.evidenceCatalog.totalDocuments).toBe(0);
    expect(view.evidenceCatalog.connectors).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/Acme|1,292|1292/);
  });
});

// silence unused vi in case we expand mocks
void vi;
