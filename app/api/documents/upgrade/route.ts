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
import { kickoffDocumentProcessingBatch } from "@/lib/uploads/kickoff";
import { markAndEnqueueStaleDocuments } from "@/lib/uploads/version-upgrade";
import {
  STALE_REPROCESS_BATCH_LIMIT,
  STALE_REPROCESS_CONCURRENCY,
} from "@/lib/uploads/versions";

export const maxDuration = 60;

/**
 * POST /api/documents/upgrade
 * Authenticated company action: enqueue only version-stale documents
 * ("Reprocess outdated documents"), not every document indiscriminately.
 */
export async function POST(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Document upgrade is not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      documentIds?: string[];
    };
    const limit =
      typeof body.limit === "number" &&
      Number.isFinite(body.limit) &&
      body.limit > 0
        ? Math.min(Math.floor(body.limit), STALE_REPROCESS_BATCH_LIMIT)
        : STALE_REPROCESS_BATCH_LIMIT;
    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.map((id) => String(id).trim()).filter(Boolean)
      : undefined;

    const client = createServiceClient();
    const result = await markAndEnqueueStaleDocuments({
      client,
      companyId,
      limit,
      documentIds,
    });

    const kickoffs =
      result.enqueued.length > 0
        ? await kickoffDocumentProcessingBatch({
            companyId,
            documentIds: result.enqueued,
            request,
            client,
            concurrency: STALE_REPROCESS_CONCURRENCY,
          })
        : [];

    return NextResponse.json({
      markedStale: result.markedStale,
      enqueued: result.enqueued,
      kickedOff: kickoffs.filter((k) => k.accepted).length,
      kickoffs,
      limit,
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
