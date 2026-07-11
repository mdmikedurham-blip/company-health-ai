import { NextResponse } from "next/server";
import { authErrorResponse, requirePrimaryCompany } from "@/lib/auth/session";
import {
  buildDiligenceBundle,
  DILIGENCE_CATALOG_VERSION,
  listCompanyQuestionAnswers,
} from "@/lib/diligence";
import { getCompanyAssessmentGoal } from "@/lib/assessment-goals";
import { getCompanyClassification } from "@/lib/classification/persist";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/questions
 * Exposes question catalog, answers, coverage, confidence, and missing evidence.
 */
export async function GET() {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Questions API is not configured." },
        { status: 503 },
      );
    }

    const client = createServiceClient();
    const [evidence, classification, goalRow, persistedAnswers] =
      await Promise.all([
        createEvidenceRepository({ client }).listByCompany(companyId),
        getCompanyClassification(client, companyId).catch(() => null),
        getCompanyAssessmentGoal({ client, companyId }).catch(() => null),
        listCompanyQuestionAnswers({ client, companyId }).catch(() => []),
      ]);

    const bundle = buildDiligenceBundle({
      companyId,
      evidence,
      stage: classification?.stage ?? null,
      assessmentGoal: goalRow?.goal ?? "run-the-company",
      snapshotId: persistedAnswers[0]?.snapshotId ?? null,
      asOf: new Date().toISOString(),
    });

    // Prefer freshly computed answers (canonical); persisted is provenance aid.
    const answers =
      persistedAnswers.length === bundle.answers.length
        ? persistedAnswers
        : bundle.answers;

    const missingEvidence = [
      ...new Set(
        answers.flatMap((a) =>
          a.state === "INSUFFICIENT_EVIDENCE" || a.state === "UNKNOWN"
            ? a.missingEvidence
            : [],
        ),
      ),
    ];

    return NextResponse.json({
      catalogVersion: DILIGENCE_CATALOG_VERSION,
      assessmentGoal: goalRow?.goal ?? "run-the-company",
      stage: classification?.stage ?? null,
      questions: bundle.questions,
      answers: bundle.answers,
      prioritizedQuestionIds: bundle.prioritizedQuestionIds,
      coverage: bundle.coverage,
      confidence: {
        mean: bundle.coverage.meanConfidence,
        method: "question_evidence_backed",
      },
      missingEvidence,
      provenance: {
        companyId,
        snapshotId: bundle.coverage.snapshotId,
        userId: ctx.user.id,
        evidenceCount: evidence.length,
      },
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
