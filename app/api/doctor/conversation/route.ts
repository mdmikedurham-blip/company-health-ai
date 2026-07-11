import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { loadDoctorHome } from "@/lib/doctor/conversation/engine";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/conversation
 * Returns current investigation, requested evidence, recommendations, state.
 */
export async function GET() {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Doctor conversation engine is not configured." },
        { status: 503 },
      );
    }
    const client = createServiceClient();
    const home = await loadDoctorHome({
      client,
      companyId,
      userId: ctx.user.id,
    });
    return NextResponse.json({
      home,
      currentInvestigation: home.currentInvestigation,
      requestedEvidence: home.requestedEvidence,
      recommendations: home.nextRecommendedAction
        ? [home.nextRecommendedAction]
        : [],
      conversation: home.conversation,
      completedInvestigations: home.completedInvestigations,
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}

/**
 * POST /api/doctor/conversation
 * Body: { completeCurrent?: boolean, message?: string }
 * Advances the mentor cycle (one ask / one evidence request / one action).
 */
export async function POST(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Doctor conversation engine is not configured." },
        { status: 503 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      completeCurrent?: boolean;
      message?: string;
    };
    const client = createServiceClient();
    const home = await loadDoctorHome({
      client,
      companyId,
      userId: ctx.user.id,
      completeCurrent: body.completeCurrent === true,
      userMessage: typeof body.message === "string" ? body.message : null,
    });
    return NextResponse.json({
      home,
      currentInvestigation: home.currentInvestigation,
      requestedEvidence: home.requestedEvidence,
      recommendations: home.nextRecommendedAction
        ? [home.nextRecommendedAction]
        : [],
      conversation: home.conversation,
      completedInvestigations: home.completedInvestigations,
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
