import { NextResponse } from "next/server";
import { disconnectGoogleDrive } from "@/lib/connectors/google-drive";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";

/**
 * POST /api/connectors/google-drive/disconnect
 * Disconnects Drive for the caller's primary company. Ignores body companyId.
 */
export async function POST() {
  try {
    const { companyId } = await requirePrimaryCompany();
    await disconnectGoogleDrive({ companyId });
    return NextResponse.json({ ok: true, companyId });
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
