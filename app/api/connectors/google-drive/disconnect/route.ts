import { NextResponse } from "next/server";
import {
  disconnectGoogleDrive,
  getDefaultCompanyId,
} from "@/lib/connectors/google-drive";

/**
 * POST /api/connectors/google-drive/disconnect
 * Body: { companyId?: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      companyId?: string;
    };
    const companyId = body.companyId ?? getDefaultCompanyId();
    await disconnectGoogleDrive({ companyId });
    return NextResponse.json({ ok: true, companyId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
