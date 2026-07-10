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
import { completeManualUpload } from "@/lib/uploads";

/**
 * POST /api/documents/upload/complete
 * Body JSON: { documentId }
 * Verifies the object exists in Storage and enqueues the document (status=QUEUED).
 * Does not run analysis.
 */
export async function POST(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Document uploads are not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { documentId?: string };
    const documentId = String(body.documentId ?? "").trim();
    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required." },
        { status: 400 },
      );
    }

    const client = createServiceClient();
    const document = await completeManualUpload({
      client,
      companyId,
      userId: ctx.user.id,
      documentId,
    });

    return NextResponse.json({
      document,
      enqueued: true,
      status: document.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("Upload not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
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
