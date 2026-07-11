import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { assertCanWrite } from "@/lib/auth/roles";
import {
  buildAssessmentGoalDashboardContext,
  isAssessmentGoalId,
  loadAssessmentGoalDashboardContext,
  setCompanyAssessmentGoal,
} from "@/lib/assessment-goals";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/assessment-goal
 * Returns current assessment goal + dashboard context for the primary company.
 */
export async function GET() {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Assessment goals are not configured." },
        { status: 503 },
      );
    }
    const client = createServiceClient();
    const assessmentGoal = await loadAssessmentGoalDashboardContext({
      client,
      companyId,
      userId: ctx.user.id,
    });
    return NextResponse.json({ assessmentGoal });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}

/**
 * POST /api/company/assessment-goal
 * Body: { goal: AssessmentGoalId }
 * Updates the company assessment goal (writers only). Does not change scoring.
 */
export async function POST(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Assessment goals are not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { goal?: string };
    if (!body.goal || !isAssessmentGoalId(body.goal)) {
      return NextResponse.json(
        { error: "Invalid assessment goal." },
        { status: 400 },
      );
    }

    const client = createServiceClient();
    const goal = await setCompanyAssessmentGoal({
      client,
      companyId,
      goal: body.goal,
      selectedBy: ctx.user.id,
    });
    const assessmentGoal = buildAssessmentGoalDashboardContext(goal);
    return NextResponse.json({ assessmentGoal });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("write access")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
