import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { getCompanyAssessmentGoal } from "@/lib/assessment-goals";
import { getCurrentAssessmentSnapshot } from "@/lib/assessment-snapshots";
import {
  computeQuestionCoverage,
  listCompanyQuestionAnswers,
} from "@/lib/diligence";
import {
  interpretSnapshotWithPlaybook,
  interpretWithPlaybook,
  listPlaybookMetas,
} from "@/lib/playbooks";
import { getCompanyClassification } from "@/lib/classification/persist";
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
 *
 * Returns current playbook interpretation for the company's assessment goal.
 * Prefers a single Assessment Snapshot pack — never mixes snapshot objects.
 * Changing the goal recomputes priorities/readiness only (no re-extraction).
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

    const current = await getCurrentAssessmentSnapshot({
      client,
      companyId,
    }).catch(() => null);

    const evidence = await createEvidenceRepository({ client })
      .listByCompany(companyId)
      .catch(() => []);

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

    // Prefer immutable snapshot pack (single source of truth).
    if (current?.pack) {
      const playbook = interpretSnapshotWithPlaybook({
        companyId,
        pack: current.pack,
        assessmentGoal: playbookId,
        presentEvidenceTypes,
      });

      return NextResponse.json({
        playbook,
        availablePlaybooks: listPlaybookMetas(),
        readiness: playbook.readiness,
        criticalBlockers: playbook.criticalBlockers,
        uploadPriorities: playbook.uploadPriorities,
        prioritizedQuestions: playbook.prioritizedQuestionIds,
        prioritizedRecommendations: playbook.prioritizedRecommendationIds,
        reportSections: playbook.reportSections,
        provenance: playbook.provenance,
      });
    }

    // No published pack yet — interpret live projection scoped to this company only.
    // Still no demo/mock fallback.
    const [answers, recommendations, risks, latest, classification] =
      await Promise.all([
        listCompanyQuestionAnswers({ client, companyId }).catch(() => []),
        listRecommendations(client, companyId),
        listRisks(client, companyId),
        getLatestHealthScore(client, companyId),
        getCompanyClassification(client, companyId).catch(() => null),
      ]);

    const coverage =
      answers.length > 0
        ? computeQuestionCoverage({
            companyId,
            answers,
            snapshotId: current?.snapshotId ?? null,
          })
        : null;

    const playbook = interpretWithPlaybook({
      companyId,
      assessmentGoal: playbookId,
      snapshotId: current?.snapshotId ?? null,
      companyStage: classification?.stage ?? null,
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
      readiness: playbook.readiness,
      criticalBlockers: playbook.criticalBlockers,
      uploadPriorities: playbook.uploadPriorities,
      prioritizedQuestions: playbook.prioritizedQuestionIds,
      prioritizedRecommendations: playbook.prioritizedRecommendationIds,
      reportSections: playbook.reportSections,
      provenance: playbook.provenance,
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
