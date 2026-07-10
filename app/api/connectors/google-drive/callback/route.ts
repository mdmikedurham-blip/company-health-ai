import { NextResponse } from "next/server";
import {
  completeGoogleDriveOAuth,
  parseOAuthState,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";

/**
 * GET /api/connectors/google-drive/callback
 * Exchanges code → stores encrypted refresh token → kicks off first sync.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/dna?gdrive=error&reason=${encodeURIComponent(error)}`, url.origin),
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
    const { companyId } = parseOAuthState(state);
    await completeGoogleDriveOAuth({ code, companyId });
    // Best-effort initial sync; connection already stored if this fails.
    await syncGoogleDriveForCompany(companyId);
    return NextResponse.redirect(
      new URL("/dna?gdrive=connected", url.origin),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/dna?gdrive=error&reason=${encodeURIComponent(message)}`,
        url.origin,
      ),
    );
  }
}
