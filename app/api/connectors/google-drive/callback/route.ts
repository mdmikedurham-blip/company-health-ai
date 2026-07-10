import { NextResponse } from "next/server";
import {
  completeGoogleDriveOAuth,
  parseOAuthState,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";
import {
  authErrorResponse,
  requireUser,
  listMembershipsForUser,
} from "@/lib/auth/session";
import { assertCompanyAccess } from "@/lib/auth/route-guards";

/**
 * GET /api/connectors/google-drive/callback
 * Requires authenticated session matching OAuth state userId.
 * Exchanges code → stores encrypted refresh token → kicks off first sync.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/connectors?gdrive=error&reason=${encodeURIComponent(error)}`,
        url.origin,
      ),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const payload = parseOAuthState(state);

    if (payload.userId !== user.id) {
      throw new Error("OAuth state user mismatch");
    }

    const memberships = await listMembershipsForUser(user.id);
    const companyId = assertCompanyAccess(
      memberships.map((m) => m.companyId),
      payload.companyId,
    );

    await completeGoogleDriveOAuth({
      code,
      companyId,
      connectedByUserId: user.id,
    });

    // Best-effort initial sync; connection already stored if this fails.
    try {
      await syncGoogleDriveForCompany(companyId);
    } catch {
      // Connection succeeded; sync status will show on connectors page.
    }

    return NextResponse.redirect(
      new URL("/connectors?gdrive=connected", url.origin),
    );
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    if (status === 401) {
      return NextResponse.redirect(
        new URL(
          `/login?next=${encodeURIComponent("/connectors")}`,
          url.origin,
        ),
      );
    }
    return NextResponse.redirect(
      new URL(
        `/connectors?gdrive=error&reason=${encodeURIComponent(message)}`,
        url.origin,
      ),
    );
  }
}
