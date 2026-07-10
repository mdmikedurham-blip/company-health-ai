import { NextResponse } from "next/server";
import {
  GOOGLE_DRIVE_CONNECTOR_ID,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";
import { unauthorizedCronResponse } from "@/lib/api/cron-auth";
import {
  createServiceClient,
  isSupabaseConfigured,
  listConnectedCompaniesForConnector,
} from "@/lib/supabase";

/**
 * GET|POST /api/cron/sync-connectors
 * Vercel Cron entry — syncs all companies with connected Google Drive.
 */
async function runScheduledSync(request: Request) {
  const unauthorized = unauthorizedCronResponse(request);
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const client = createServiceClient();
    const companyIds = await listConnectedCompaniesForConnector(
      client,
      GOOGLE_DRIVE_CONNECTOR_ID,
    );

    const results = [];
    for (const companyId of companyIds) {
      results.push(await syncGoogleDriveForCompany(companyId, client));
    }

    return NextResponse.json({
      connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
      companies: companyIds.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runScheduledSync(request);
}

export async function POST(request: Request) {
  return runScheduledSync(request);
}
