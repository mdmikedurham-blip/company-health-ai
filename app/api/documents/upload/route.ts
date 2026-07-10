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
  createManualUploadSession,
  validateUploadRequest,
} from "@/lib/uploads";

/**
 * POST /api/documents/upload
 * Body JSON: { filename, mimeType, byteSize }
 * Creates a documents row (status=UPLOADED) and returns a signed Storage URL.
 * Does not analyze the file.
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

    const body = (await request.json()) as {
      filename?: string;
      mimeType?: string;
      byteSize?: number;
    };

    const validated = validateUploadRequest({
      filename: String(body.filename ?? ""),
      mimeType: body.mimeType,
      byteSize: Number(body.byteSize),
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const client = createServiceClient();
    const session = await createManualUploadSession({
      client,
      companyId,
      userId: ctx.user.id,
      filename: validated.filename,
      mimeType: validated.mimeType,
      byteSize: validated.byteSize,
    });

    return NextResponse.json({
      documentId: session.documentId,
      storagePath: session.storagePath,
      bucket: session.bucket,
      signedUrl: session.signedUrl,
      token: session.token,
      filename: session.filename,
      mimeType: session.mimeType,
      byteSize: session.byteSize,
      status: "UPLOADED",
    });
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    if (message.includes("write access")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
