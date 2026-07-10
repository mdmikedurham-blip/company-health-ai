import { NextResponse } from "next/server";
import {
  createServiceClient,
  getConnectorConnectionStatus,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "@/lib/connectors/google-drive/constants";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import {
  hasCompletedAnalysis,
  listLatestConnectorSync,
} from "@/lib/auth/connector-status";

/**
 * GET /api/connectors/google-drive/status
 * Returns connection + latest sync status without token material.
 */
export async function GET() {
  try {
    const { companyId } = await requirePrimaryCompany();

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        companyId,
        connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
        status: "pending",
        syncStatus: null,
        configured: false,
        analysisReady: false,
      });
    }

    const client = createServiceClient();
    const connection = await getConnectorConnectionStatus(
      client,
      companyId,
      GOOGLE_DRIVE_CONNECTOR_ID,
    );
    const latestSync = await listLatestConnectorSync(
      client,
      companyId,
      GOOGLE_DRIVE_CONNECTOR_ID,
    );
    const analysisReady = await hasCompletedAnalysis(client, companyId);

    return NextResponse.json({
      companyId,
      connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
      configured: true,
      status: connection?.status ?? "pending",
      accountEmail: connection?.accountEmail ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      scopes: connection?.scopes ?? [],
      syncStatus: latestSync?.status ?? null,
      syncError: latestSync?.error_message ?? null,
      documentsAnalyzed: latestSync?.documents_analyzed ?? null,
      evidenceCreated: latestSync?.evidence_created ?? null,
      analysisReady,
    });
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
