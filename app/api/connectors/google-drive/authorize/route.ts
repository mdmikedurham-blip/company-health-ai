import { NextResponse } from "next/server";
import {
  buildGoogleDriveAuthorizeUrl,
  getDefaultCompanyId,
} from "@/lib/connectors/google-drive";

/**
 * GET /api/connectors/google-drive/authorize?companyId=...
 * Redirects to Google OAuth consent (drive.readonly, offline refresh token).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId =
      url.searchParams.get("companyId") ?? getDefaultCompanyId();
    const authorizeUrl = buildGoogleDriveAuthorizeUrl(companyId);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
