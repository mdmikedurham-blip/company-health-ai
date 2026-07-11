/**
 * Persist / load company_assessment_goals.
 * New companies default to Run the Company without user interaction.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  AssessmentGoalDashboardContext,
  AssessmentGoalId,
  CompanyAssessmentGoal,
} from "@/lib/domain/assessment-goal";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import "@/lib/assessment-goals/register";
import { getGoalProvider, listGoalMetas } from "./registry";
import { isAssessmentGoalId } from "./provider";

type GoalRow = {
  company_id: string;
  goal: string;
  selected_by: string | null;
  selected_at: string;
  last_updated: string;
  updated_at?: string;
};

function rowToGoal(row: GoalRow): CompanyAssessmentGoal {
  const goal = isAssessmentGoalId(row.goal)
    ? row.goal
    : DEFAULT_ASSESSMENT_GOAL;
  return {
    companyId: row.company_id,
    goal,
    selectedBy: row.selected_by,
    selectedAt: row.selected_at,
    lastUpdated: row.last_updated || row.updated_at || row.selected_at,
  };
}

export function buildAssessmentGoalDashboardContext(
  goal: CompanyAssessmentGoal,
): AssessmentGoalDashboardContext {
  const provider = getGoalProvider(goal.goal);
  return {
    goal: goal.goal,
    label: provider.label,
    purpose: provider.purpose,
    selectedBy: goal.selectedBy,
    selectedAt: goal.selectedAt,
    lastUpdated: goal.lastUpdated,
    uploadPriorities: provider.getUploadPriorities(),
    dashboardWidgets: provider.getDashboardWidgets(),
    operatingLenses: provider.getOperatingLenses?.() ?? [],
    availableGoals: listGoalMetas(),
  };
}

/**
 * Ensure a row exists (default Run the Company). Idempotent.
 */
export async function ensureCompanyAssessmentGoal(input: {
  client: AppSupabaseClient;
  companyId: string;
  selectedBy?: string | null;
}): Promise<CompanyAssessmentGoal> {
  const existing = await getCompanyAssessmentGoal(input);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data, error } = await input.client
    .from("company_assessment_goals")
    .upsert(
      {
        company_id: input.companyId,
        goal: DEFAULT_ASSESSMENT_GOAL,
        selected_by: input.selectedBy ?? null,
        selected_at: now,
        last_updated: now,
      },
      { onConflict: "company_id", ignoreDuplicates: true },
    )
    .select(
      "company_id, goal, selected_by, selected_at, last_updated, updated_at",
    )
    .maybeSingle();

  if (error) {
    // Race: another writer inserted — re-read.
    const again = await getCompanyAssessmentGoal(input);
    if (again) return again;
    throw new Error(`ensureCompanyAssessmentGoal: ${error.message}`);
  }

  if (data) return rowToGoal(data as GoalRow);

  const again = await getCompanyAssessmentGoal(input);
  if (again) return again;

  // Fallback when table missing in older envs — in-memory default.
  return {
    companyId: input.companyId,
    goal: DEFAULT_ASSESSMENT_GOAL,
    selectedBy: input.selectedBy ?? null,
    selectedAt: now,
    lastUpdated: now,
  };
}

export async function getCompanyAssessmentGoal(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<CompanyAssessmentGoal | null> {
  const { data, error } = await input.client
    .from("company_assessment_goals")
    .select(
      "company_id, goal, selected_by, selected_at, last_updated, updated_at",
    )
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (error) {
    // Table may not exist yet in some test/mock clients.
    if (/does not exist|PGRST|schema cache/i.test(error.message)) {
      return null;
    }
    throw new Error(`getCompanyAssessmentGoal: ${error.message}`);
  }
  if (!data) return null;
  return rowToGoal(data as GoalRow);
}

export async function setCompanyAssessmentGoal(input: {
  client: AppSupabaseClient;
  companyId: string;
  goal: AssessmentGoalId;
  selectedBy: string;
}): Promise<CompanyAssessmentGoal> {
  if (!isAssessmentGoalId(input.goal)) {
    throw new Error(`Invalid assessment goal: ${input.goal}`);
  }
  // Ensure provider exists (factory lookup — no switch).
  getGoalProvider(input.goal);

  const now = new Date().toISOString();
  const { data, error } = await input.client
    .from("company_assessment_goals")
    .upsert(
      {
        company_id: input.companyId,
        goal: input.goal,
        selected_by: input.selectedBy,
        selected_at: now,
        last_updated: now,
      },
      { onConflict: "company_id" },
    )
    .select(
      "company_id, goal, selected_by, selected_at, last_updated, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `setCompanyAssessmentGoal: ${error?.message ?? "no row returned"}`,
    );
  }
  return rowToGoal(data as GoalRow);
}

/**
 * Load goal + provider dashboard context. Creates default if missing.
 */
export async function loadAssessmentGoalDashboardContext(input: {
  client: AppSupabaseClient;
  companyId: string;
  userId?: string | null;
}): Promise<AssessmentGoalDashboardContext> {
  const goal = await ensureCompanyAssessmentGoal({
    client: input.client,
    companyId: input.companyId,
    selectedBy: input.userId ?? null,
  });
  return buildAssessmentGoalDashboardContext(goal);
}
