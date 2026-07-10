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
import { cancelManualUploadProcessing } from "@/lib/uploads/cancel";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/[id]/cancel
 * Safely cancel in-flight PROCESSING / EXTRACTED / ANALYZING jobs.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Cancel is not configured." },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const documentId = String(id ?? "").trim();
    if (!documentId) {
      return NextResponse.json({ error: "document id is required" }, { status: 400 });
    }

    const client = createServiceClient();
    const result = await cancelManualUploadProcessing({
      client,
      companyId,
      documentId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      typeof err === "object" &&
      err &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : undefined;
    if (status === 404) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (status === 409) {
      return NextResponse.json({ error: message }, { status: 409 });
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
