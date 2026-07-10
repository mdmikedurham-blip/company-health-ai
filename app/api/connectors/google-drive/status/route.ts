import { NextResponse } from "next/server";
import { getDefaultCompanyId } from "@/lib/connectors/google-drive";
import {
  createServiceClient,
  getConnectorConnectionStatus,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "@/lib/connectors/google-drive/constants";

/**
 * GET /api/connectors/google-drive/status?companyId=...
 * Returns connection status without token material.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId =
    url.searchParams.get("companyId") ?? getDefaultCompanyId();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      companyId,
      connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
      status: "pending",
      configured: false,
    });
  }

  try {
    const connection = await getConnectorConnectionStatus(
      createServiceClient(),
      companyId,
      GOOGLE_DRIVE_CONNECTOR_ID,
    );
    return NextResponse.json({
      companyId,
      connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
      configured: true,
      status: connection?.status ?? "pending",
      accountEmail: connection?.accountEmail ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      scopes: connection?.scopes ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
