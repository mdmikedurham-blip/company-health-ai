import { NextResponse } from "next/server";
import {
  completeGoogleDriveOAuth,
  consumeOAuthNonce,
  parseOAuthState,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";
import {
  authErrorResponse,
  requireUser,
  listMembershipsForUser,
} from "@/lib/auth/session";
import { assertCompanyAccess } from "@/lib/auth/route-guards";
import { buildSingleConnectorCatalog } from "@/lib/connectors/ingest";
import {
  analyzeAndPersistIncremental,
  shouldRescoreIncremental,
} from "@/lib/application/incremental-analysis";
import {
  companyBriefSeed,
  companyDNA as dnaProfile,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "@/lib/connectors/google-drive/constants";

/**
 * GET /api/connectors/google-drive/callback
 * Requires authenticated session matching OAuth state userId.
 * Exchanges code → stores encrypted refresh token → kicks off first sync + analysis.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/connectors?gdrive=error&reason=${encodeURIComponent("Connection cancelled.")}`,
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

    const nonceOk = await consumeOAuthNonce({
      nonce: payload.nonce,
      userId: user.id,
      companyId,
    });
    if (!nonceOk) {
      throw new Error("OAuth state already used or expired");
    }

    await completeGoogleDriveOAuth({
      code,
      companyId,
      connectedByUserId: user.id,
    });

    // Best-effort initial sync + analysis; connection already stored if this fails.
    try {
      if (isSupabaseConfigured()) {
        const client = createServiceClient();
        const sync = await syncGoogleDriveForCompany(companyId, client, {
          mode: "incremental",
        });

        if (
          sync.status === "succeeded" &&
          shouldRescoreIncremental(sync.delta) &&
          sync.changedEvidenceIds.length > 0
        ) {
          const companyName =
            memberships.find((m) => m.companyId === companyId)?.companyName ??
            companyId;
          const company =
            companyId === companyProfile.id
              ? companyProfile
              : { ...companyProfile, id: companyId, name: companyName };

          await analyzeAndPersistIncremental({
            company,
            changedEvidenceIds: sync.changedEvidenceIds,
            dimensionProfiles,
            previousHealthScore,
            dna: dnaProfile,
            reports: companyReports,
            timelineSeed: companyTimelineSeed,
            briefSeed: companyBriefSeed,
            evidenceCatalog: buildSingleConnectorCatalog({
              connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
              name: "Google Drive",
              system: "Google Drive",
              documentsAnalyzed: sync.documentsAnalyzed,
              lastSynced: new Date().toISOString(),
              lastFullScan: new Date().toISOString(),
            }),
            client,
          });
        }
      } else {
        await syncGoogleDriveForCompany(companyId);
      }
    } catch {
      // Connection succeeded; sync status will show on connectors page.
    }

    return NextResponse.redirect(
      new URL("/connectors?gdrive=connected", url.origin),
    );
  } catch (err) {
    const { status } = authErrorResponse(err);
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
        `/connectors?gdrive=error&reason=${encodeURIComponent("Connection failed. Please try again.")}`,
        url.origin,
      ),
    );
  }
}
