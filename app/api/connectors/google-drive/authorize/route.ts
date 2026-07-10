import { NextResponse } from "next/server";
import { buildGoogleDriveAuthorizeUrl } from "@/lib/connectors/google-drive";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";

/**
 * GET /api/connectors/google-drive/authorize
 * Requires an authenticated session. companyId is derived from membership.
 */
export async function GET(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    const authorizeUrl = buildGoogleDriveAuthorizeUrl({
      companyId,
      userId: ctx.user.id,
    });
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    const origin = new URL(request.url).origin;
    if (status === 401) {
      return NextResponse.redirect(new URL("/login", origin));
    }
    if (status === 403) {
      return NextResponse.redirect(new URL("/onboarding", origin));
    }
    return NextResponse.json({ error: message }, { status });
  }
}
