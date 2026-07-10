/**
 * Scheduled / on-demand Google Drive sync for a company.
 * Crawls Drive → upserts documents → records connector_syncs audit.
 */
import {
  createServiceClient,
  finishConnectorSync,
  isSupabaseConfigured,
  startConnectorSync,
  updateConnectorCredential,
  upsertDocuments,
  type AppSupabaseClient,
  type TablesInsert,
} from "@/lib/supabase";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "./constants";
import { createGoogleDriveAdapter } from "./production-adapter";

export type GoogleDriveSyncResult = {
  companyId: string;
  syncId: string | null;
  status: "succeeded" | "failed" | "skipped";
  documentsAnalyzed: number;
  extractedDocuments: number;
  errorMessage?: string;
};

export async function syncGoogleDriveForCompany(
  companyId: string,
  client?: AppSupabaseClient,
): Promise<GoogleDriveSyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      companyId,
      syncId: null,
      status: "skipped",
      documentsAnalyzed: 0,
      extractedDocuments: 0,
      errorMessage: "Supabase is not configured",
    };
  }

  const db = client ?? createServiceClient();
  const syncId = await startConnectorSync(db, {
    companyId,
    connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
  });

  try {
    const adapter = createGoogleDriveAdapter({ companyId });
    await adapter.connect();
    const raw = await adapter.sync();
    const extractedCount =
      "extractedDocuments" in raw && Array.isArray(raw.extractedDocuments)
        ? raw.extractedDocuments.length
        : 0;

    const rows: TablesInsert<"documents">[] = raw.items.map((item) => ({
      company_id: companyId,
      connector_id: GOOGLE_DRIVE_CONNECTOR_ID,
      external_id: item.externalId,
      title: item.title,
      path: item.path ?? null,
      modified_at: item.modifiedAt ?? null,
      owner: item.owner ?? null,
      mime_type: item.mimeType ?? null,
      content_hash: item.contentHash ?? null,
      uri: item.metadata?.uri || null,
      raw_summary: item.rawSummary,
      metadata: item.metadata ?? {},
      synced_at: item.syncedAt,
    }));

    await upsertDocuments(db, rows);
    await updateConnectorCredential(db, companyId, GOOGLE_DRIVE_CONNECTOR_ID, {
      last_synced_at: new Date().toISOString(),
      status: "connected",
    });
    await finishConnectorSync(db, syncId, {
      status: "succeeded",
      documentsAnalyzed: raw.documentsAnalyzed,
      evidenceCreated: 0,
      metadata: { extractedDocuments: extractedCount },
    });

    return {
      companyId,
      syncId,
      status: "succeeded",
      documentsAnalyzed: raw.documentsAnalyzed,
      extractedDocuments: extractedCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishConnectorSync(db, syncId, {
      status: "failed",
      errorMessage: message,
    });
    await updateConnectorCredential(db, companyId, GOOGLE_DRIVE_CONNECTOR_ID, {
      status: "error",
    }).catch(() => undefined);

    return {
      companyId,
      syncId,
      status: "failed",
      documentsAnalyzed: 0,
      extractedDocuments: 0,
      errorMessage: message,
    };
  }
}
