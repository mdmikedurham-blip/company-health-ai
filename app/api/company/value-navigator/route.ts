import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { getCompanyAssessmentGoal } from "@/lib/assessment-goals";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { ValueScenarioKey } from "@/lib/domain/value-navigator";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { buildOpportunityNavigatorFromEvidence } from "@/lib/enterprise-value";
import {
  applyScenario,
  estimateEnterpriseValue,
  listScenarioCatalog,
  valuationInputFromEvidence,
} from "@/lib/value-navigator";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/value-navigator
 * Returns Value Navigator for the primary company (ranges + drivers + scenarios).
 *
 * POST { scenarioKey } — apply an isolated scenario (never mutates assessment SSOT).
 */
export async function GET() {
  try {
    const { companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Value Navigator is not configured." },
        { status: 503 },
      );
    }

    const client = createServiceClient();
    const goalRow = await getCompanyAssessmentGoal({ client, companyId });
    const assessmentGoal = (goalRow?.goal ??
      DEFAULT_ASSESSMENT_GOAL) as AssessmentGoalId;

    const evidence = await createEvidenceRepository({ client })
      .listByCompany(companyId)
      .catch(() => []);

    let snapshotId: string | null = null;
    try {
      const { data: companyRow } = await client
        .from("companies")
        .select("current_snapshot_id")
        .eq("id", companyId)
        .maybeSingle();
      snapshotId =
        (companyRow as { current_snapshot_id?: string | null } | null)
          ?.current_snapshot_id ?? null;
    } catch {
      snapshotId = null;
    }

    const view = buildOpportunityNavigatorFromEvidence({
      companyId,
      snapshotId,
      assessmentGoal,
      evidence,
    });

    return NextResponse.json({
      ...view,
      scenarioCatalog: listScenarioCatalog(),
    });
  } catch (error) {
    const mapped = authErrorResponse(error);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Value Navigator is not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      scenarioKey?: string;
    };
    if (!body.scenarioKey) {
      return NextResponse.json(
        { error: "scenarioKey is required." },
        { status: 400 },
      );
    }

    const client = createServiceClient();
    const goalRow = await getCompanyAssessmentGoal({ client, companyId });
    const assessmentGoal = (goalRow?.goal ??
      DEFAULT_ASSESSMENT_GOAL) as AssessmentGoalId;

    const evidence = await createEvidenceRepository({ client })
      .listByCompany(companyId)
      .catch(() => []);

    let snapshotId: string | null = null;
    try {
      const { data: companyRow } = await client
        .from("companies")
        .select("current_snapshot_id")
        .eq("id", companyId)
        .maybeSingle();
      snapshotId =
        (companyRow as { current_snapshot_id?: string | null } | null)
          ?.current_snapshot_id ?? null;
    } catch {
      snapshotId = null;
    }

    const baseInput = valuationInputFromEvidence({
      companyId,
      snapshotId,
      assessmentGoal,
      evidence,
    });
    const baseEstimate = estimateEnterpriseValue(baseInput);
    const scenario = applyScenario({
      baseInput,
      baseEstimate,
      key: body.scenarioKey as ValueScenarioKey,
    });

    // Isolation guarantee: base assessment inputs unchanged.
    return NextResponse.json({
      scenario,
      baseUnchanged: {
        snapshotId,
        currentRange: baseEstimate.currentRange,
        confidence: baseEstimate.confidence,
      },
      isolatedFromAssessment: true as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.startsWith("Unknown scenario")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const mapped = authErrorResponse(error);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
