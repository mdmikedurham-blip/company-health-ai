import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { assertCanWrite } from "@/lib/auth/roles";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { requeueDocumentJobs } from "@/lib/uploads/claim";
import { kickoffDocumentProcessingBatch } from "@/lib/uploads/kickoff";
import {
  isPipelineStep,
  requeueFromPipelineStep,
  resumePipelineStep,
} from "@/lib/uploads/pipeline";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";

export const maxDuration = 60;

/**
 * POST /api/documents/retry
 * Body: { documentIds?: string[] }
 *
 * For FAILED docs with a failed_step: resume only that step (never full restart).
 * Otherwise requeues stale/failed jobs and kicks off processing.
 */
export async function POST(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Retry is not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      documentIds?: string[];
    };
    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.map((id) => String(id).trim()).filter(Boolean)
      : undefined;

    const client = createServiceClient();

    // Prefer step-level resume for FAILED documents with a known failed_step.
    const resumed: string[] = [];
    if (documentIds?.length) {
      const { data: rows } = await client
        .from("documents")
        .select(
          "id, status, failed_step, last_successful_pipeline_step, retryable, pipeline_step",
        )
        .eq("company_id", companyId)
        .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
        .in("id", documentIds);

      for (const row of rows ?? []) {
        if (row.status !== "FAILED") continue;
        if (row.retryable === false) continue;
        const resumeStep = resumePipelineStep({
          failedStep: row.failed_step,
          lastSuccessfulStep: row.last_successful_pipeline_step,
        });
        if (!isPipelineStep(resumeStep)) continue;
        await requeueFromPipelineStep({
          client,
          companyId,
          documentId: row.id,
          resumeStep,
          lastSuccessfulStep: row.last_successful_pipeline_step,
          reason: "retry_failed_step_only",
        });
        resumed.push(row.id);
      }
    }

    const remainingIds = documentIds?.filter((id) => !resumed.includes(id));
    const requeued =
      remainingIds === undefined || remainingIds.length > 0
        ? await requeueDocumentJobs({
            client,
            companyId,
            documentIds: remainingIds,
          })
        : [];

    const allIds = [...new Set([...resumed, ...requeued])];
    const kickoffs =
      allIds.length > 0
        ? await kickoffDocumentProcessingBatch({
            companyId,
            documentIds: allIds,
            request,
            client,
          })
        : [];

    return NextResponse.json({
      requeued: allIds,
      resumedFailedSteps: resumed,
      kickedOff: kickoffs.filter((k) => k.accepted).length,
      kickoffs,
    });
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
