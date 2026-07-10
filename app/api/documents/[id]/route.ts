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
import {
  removeManualUploadDocument,
  repairManualUploadRemoval,
} from "@/lib/uploads/removal";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/documents/[id]
 * Removes a manual-upload document for the authenticated company.
 * Query: ?repair=1 to finish a partial removal.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const membership = ctx.memberships.find((m) => m.companyId === companyId);
    assertCanWrite(membership?.role);

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Document removal is not configured." },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const documentId = String(id ?? "").trim();
    if (!documentId) {
      return NextResponse.json({ error: "document id is required" }, { status: 400 });
    }

    const url = new URL(request.url);
    const repair = url.searchParams.get("repair") === "1";
    const client = createServiceClient();

    const result = repair
      ? await repairManualUploadRemoval({ client, companyId, documentId })
      : await removeManualUploadDocument({ client, companyId, documentId });

    return NextResponse.json(result, {
      status: result.removed || result.alreadyGone ? 200 : 207,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      typeof err === "object" &&
      err &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : undefined;
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
