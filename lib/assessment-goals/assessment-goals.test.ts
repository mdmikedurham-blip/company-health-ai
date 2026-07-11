import { beforeEach, describe, expect, it } from "vitest";
import {
  ASSESSMENT_GOAL_IDS,
  DEFAULT_ASSESSMENT_GOAL,
} from "@/lib/domain/assessment-goal";
import {
  buildAssessmentGoalDashboardContext,
  ensureCompanyAssessmentGoal,
  getCompanyAssessmentGoal,
  getGoalProvider,
  listGoalProviders,
  setCompanyAssessmentGoal,
} from "@/lib/assessment-goals";
import { ensureGoalProvidersRegistered } from "@/lib/assessment-goals/register";
import type { AppSupabaseClient } from "@/lib/supabase/client";

type GoalRow = {
  company_id: string;
  goal: string;
  selected_by: string | null;
  selected_at: string;
  last_updated: string;
  updated_at: string;
};

function createGoalStoreClient(store: Map<string, GoalRow>): AppSupabaseClient {
  return {
    from(table: string) {
      if (table !== "company_assessment_goals") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("company_id");
              return {
                maybeSingle: async () => ({
                  data: store.get(value) ?? null,
                  error: null,
                }),
                single: async () => {
                  const row = store.get(value);
                  return row
                    ? { data: row, error: null }
                    : { data: null, error: { message: "not found" } };
                },
              };
            },
          };
        },
        upsert(
          payload: {
            company_id: string;
            goal: string;
            selected_by: string | null;
            selected_at: string;
            last_updated: string;
          },
          opts?: { onConflict?: string; ignoreDuplicates?: boolean },
        ) {
          const existing = store.get(payload.company_id);
          if (opts?.ignoreDuplicates && existing) {
            return {
              select: () => ({
                maybeSingle: async () => ({ data: existing, error: null }),
                single: async () => ({ data: existing, error: null }),
              }),
            };
          }
          const row: GoalRow = {
            company_id: payload.company_id,
            goal: payload.goal,
            selected_by: payload.selected_by,
            selected_at: payload.selected_at,
            last_updated: payload.last_updated,
            updated_at: payload.last_updated,
          };
          store.set(payload.company_id, row);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    },
  } as never;
}

describe("assessment goals framework", () => {
  beforeEach(() => {
    ensureGoalProvidersRegistered();
  });

  it("default goal is Run the Company", async () => {
    expect(DEFAULT_ASSESSMENT_GOAL).toBe("run-the-company");
    const store = new Map<string, GoalRow>();
    const client = createGoalStoreClient(store);
    const goal = await ensureCompanyAssessmentGoal({
      client,
      companyId: "co-new",
      selectedBy: "user-1",
    });
    expect(goal.goal).toBe("run-the-company");
    expect(goal.companyId).toBe("co-new");
    const ctx = buildAssessmentGoalDashboardContext(goal);
    expect(ctx.label).toBe("Run the Company");
    expect(ctx.purpose).toMatch(/operational health/i);
  });

  it("goal persists across reads", async () => {
    const store = new Map<string, GoalRow>();
    const client = createGoalStoreClient(store);
    await ensureCompanyAssessmentGoal({
      client,
      companyId: "co-persist",
      selectedBy: "user-1",
    });
    await setCompanyAssessmentGoal({
      client,
      companyId: "co-persist",
      goal: "board-readiness",
      selectedBy: "user-1",
    });
    const again = await getCompanyAssessmentGoal({
      client,
      companyId: "co-persist",
    });
    expect(again?.goal).toBe("board-readiness");
    expect(again?.selectedBy).toBe("user-1");
    expect(again?.selectedAt).toBeTruthy();
    expect(again?.lastUpdated).toBeTruthy();
  });

  it("changing goals updates dashboard context", async () => {
    const store = new Map<string, GoalRow>();
    const client = createGoalStoreClient(store);
    const run = await ensureCompanyAssessmentGoal({
      client,
      companyId: "co-ctx",
      selectedBy: "user-1",
    });
    const runCtx = buildAssessmentGoalDashboardContext(run);
    expect(runCtx.goal).toBe("run-the-company");
    expect(runCtx.uploadPriorities.length).toBeGreaterThan(0);
    expect(runCtx.operatingLenses.map((l) => l.id)).toEqual([
      "protect",
      "grow",
      "operate",
      "prepare",
      "decide",
    ]);

    const raised = await setCompanyAssessmentGoal({
      client,
      companyId: "co-ctx",
      goal: "raise-capital",
      selectedBy: "user-2",
    });
    const raisedCtx = buildAssessmentGoalDashboardContext(raised);
    expect(raisedCtx.goal).toBe("raise-capital");
    expect(raisedCtx.label).toBe("Raise Capital");
    expect(raisedCtx.purpose).not.toBe(runCtx.purpose);
    expect(raisedCtx.uploadPriorities).toEqual([]);
    expect(raisedCtx.operatingLenses).toEqual([]);
  });

  it("evidence priorities are presentation-only — shared evidence model across goals", () => {
    const run = getGoalProvider("run-the-company");
    const capital = getGoalProvider("raise-capital");
    // Goals may weight categories differently, but must not invent separate evidence stores.
    expect(run.getEvidencePriorities().every((p) => p.categoryId)).toBe(true);
    expect(capital.getEvidencePriorities()).toEqual([]);
    // Registry covers every supported goal id via factory, not a consumer switch.
    expect(listGoalProviders().map((p) => p.id).sort()).toEqual(
      [...ASSESSMENT_GOAL_IDS].sort(),
    );
  });

  it("tenant isolation — company A goal never leaks to company B", async () => {
    const store = new Map<string, GoalRow>();
    const client = createGoalStoreClient(store);
    await setCompanyAssessmentGoal({
      client,
      companyId: "co-a",
      goal: "ipo-readiness",
      selectedBy: "user-a",
    });
    await setCompanyAssessmentGoal({
      client,
      companyId: "co-b",
      goal: "run-the-company",
      selectedBy: "user-b",
    });

    const a = await getCompanyAssessmentGoal({ client, companyId: "co-a" });
    const b = await getCompanyAssessmentGoal({ client, companyId: "co-b" });
    expect(a?.goal).toBe("ipo-readiness");
    expect(b?.goal).toBe("run-the-company");
    expect(a?.companyId).not.toBe(b?.companyId);

    const missing = await getCompanyAssessmentGoal({
      client,
      companyId: "co-c",
    });
    expect(missing).toBeNull();
  });

  it("Run the Company exposes Protect/Grow/Operate/Prepare/Decide placeholders", () => {
    const provider = getGoalProvider("run-the-company");
    const lenses = provider.getOperatingLenses?.() ?? [];
    expect(lenses).toHaveLength(5);
    expect(lenses.every((l) => l.items.length === 0)).toBe(true);
    expect(provider.getDashboardWidgets().every((w) => w.placeholder)).toBe(
      true,
    );
  });
});
