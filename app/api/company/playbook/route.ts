import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { getCompanyAssessmentGoal } from "@/lib/assessment-goals";
import {
  computeQuestionCoverage,
  listCompanyQuestionAnswers,
} from "@/lib/diligence";
import { interpretWithPlaybook, listPlaybookMetas } from "@/lib/playbooks";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  getLatestHealthScore,
  listRecommendations,
  listRisks,
} from "@/lib/supabase/repository";
import { createEvidenceRepository } from "@/lib/repositories";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/playbook
 * Returns playbook interpretation for the company's current assessment goal.
 * Evidence is unchanged — only priorities, readiness, and summaries differ.
 */
export async function GET() {
  try {
    const { companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Playbooks are not configured." },
        { status: 503 },
      );
    }

    const client = createServiceClient();
    const goalRow = await getCompanyAssessmentGoal({ client, companyId });
    const playbookId = goalRow?.goal ?? "run-the-company";

    const [answers, recommendations, risks, latest, evidence] =
      await Promise.all([
        listCompanyQuestionAnswers({ client, companyId }).catch(() => []),
        listRecommendations(client, companyId),
        listRisks(client, companyId),
        getLatestHealthScore(client, companyId),
        createEvidenceRepository({ client }).listByCompany(companyId),
      ]);

    const coverage =
      answers.length > 0
        ? computeQuestionCoverage({
            companyId,
            answers,
          })
        : null;

    const presentEvidenceTypes = [
      ...new Set(
        evidence.flatMap((e) => {
          const types: string[] = [e.sourceType];
          const metaType = e.metadata?.evidenceType;
          if (typeof metaType === "string") types.push(metaType);
          return types;
        }),
      ),
    ];

    const playbook = interpretWithPlaybook({
      companyId,
      assessmentGoal: playbookId,
      answers,
      recommendations,
      risks,
      healthScore: latest?.healthScore ?? null,
      coverage,
      presentEvidenceTypes,
    });

    return NextResponse.json({
      playbook,
      availablePlaybooks: listPlaybookMetas(),
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
