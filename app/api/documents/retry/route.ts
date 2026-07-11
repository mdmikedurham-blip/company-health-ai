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

export const maxDuration = 60;

/**
 * POST /api/documents/retry
 * Body: { documentIds?: string[] }
 * Resets FAILED / stale jobs to QUEUED and awaits HTTP processing kickoff.
 * When documentIds are provided, PROCESSED docs may also be requeued so
 * extractor upgrades can re-run on already-complete files.
 * company_id is derived from authenticated membership only.
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
    const requeued = await requeueDocumentJobs({
      client,
      companyId,
      documentIds,
    });

    const kickoffs =
      requeued.length > 0
        ? await kickoffDocumentProcessingBatch({
            companyId,
            documentIds: requeued,
            request,
            client,
          })
        : [];

    return NextResponse.json({
      requeued,
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
