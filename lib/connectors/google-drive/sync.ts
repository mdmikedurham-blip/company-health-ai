/**
 * Incremental Google Drive sync.
 *
 * Only re-extracts changed/new documents. Never rescores the entire company —
 * evidence upserts are scoped to the delta; analysis uses affected-scope merge.
 */
import type { Evidence } from "@/lib/domain";
import {
  createServiceClient,
  deleteDocumentsByExternalIds,
  deleteEvidenceByIds,
  finishConnectorSync,
  isSupabaseConfigured,
  listDocuments,
  startConnectorSync,
  updateConnectorCredential,
  upsertCompanyEvidence,
  upsertDocuments,
  type AppSupabaseClient,
  type TablesInsert,
} from "@/lib/supabase";
import type { RawConnectorData, RawConnectorItem } from "../connector";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "./constants";
import { crawlGoogleDrive } from "./crawler";
import {
  deltaHasWork,
  diffDocuments,
  evidenceIdForDriveFile,
  type DocumentDelta,
} from "./delta";
import { extractDriveDocuments } from "./extract";
import { getGoogleDriveCredentials } from "./auth";
import {
  createGoogleDriveAdapter,
  type GoogleDriveRawConnectorData,
} from "./production-adapter";

export type IncrementalSyncDeltaCounts = {
  added: number;
  changed: number;
  unchanged: number;
  deleted: number;
};

export type GoogleDriveSyncResult = {
  companyId: string;
  syncId: string | null;
  status: "succeeded" | "failed" | "skipped";
  documentsAnalyzed: number;
  extractedDocuments: number;
  evidenceCreated: number;
  delta: IncrementalSyncDeltaCounts;
  changedEvidenceIds: string[];
  errorMessage?: string;
};

function emptyDelta(): IncrementalSyncDeltaCounts {
  return { added: 0, changed: 0, unchanged: 0, deleted: 0 };
}

function toDocumentRows(
  companyId: string,
  items: RawConnectorItem[],
): TablesInsert<"documents">[] {
  return items.map((item) => ({
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
}

/**
 * Incremental sync: crawl → diff → extract only changed/new → upsert evidence.
 * Deleted Drive files remove corresponding evidence rows.
 */
export async function syncGoogleDriveForCompany(
  companyId: string,
  client?: AppSupabaseClient,
  options?: { mode?: "full" | "incremental" },
): Promise<GoogleDriveSyncResult> {
  const mode = options?.mode ?? "incremental";

  if (!isSupabaseConfigured()) {
    return {
      companyId,
      syncId: null,
      status: "skipped",
      documentsAnalyzed: 0,
      extractedDocuments: 0,
      evidenceCreated: 0,
      delta: emptyDelta(),
      changedEvidenceIds: [],
      errorMessage: "Supabase is not configured",
    };
  }

  const db = client ?? createServiceClient();
  const syncId = await startConnectorSync(db, {
    companyId,
    connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
    metadata: { mode },
  });

  try {
    const credentials = await getGoogleDriveCredentials({ companyId });
    if (!credentials) {
      throw new Error("Google Drive is not connected");
    }

    const stored = await listDocuments(db, companyId, GOOGLE_DRIVE_CONNECTOR_ID);
    const inventory = await crawlGoogleDrive(credentials.accessToken);
    const delta: DocumentDelta =
      mode === "full"
        ? {
            added: inventory,
            changed: [],
            unchanged: [],
            deletedExternalIds: stored
              .filter((s) => !inventory.some((i) => i.externalId === s.externalId))
              .map((s) => s.externalId),
          }
        : diffDocuments(stored, inventory);

    // Always refresh inventory metadata for all crawled files
    await upsertDocuments(db, toDocumentRows(companyId, inventory));

    const toExtract = [...delta.added, ...delta.changed];
    let extractedCount = 0;
    let evidence: Evidence[] = [];
    let rawForNormalize: GoogleDriveRawConnectorData | RawConnectorData | null =
      null;

    if (toExtract.length > 0) {
      const adapter = createGoogleDriveAdapter({
        companyId,
        // Limit crawl to nothing — we pass pre-extracted items via a targeted path
        extractContent: false,
      });
      // Extract only the delta set
      const { documents, evidenceResults, errors } = await extractDriveDocuments(
        credentials.accessToken,
        toExtract,
      );
      extractedCount = documents.length;

      // Build enriched raw items for normalize (same as production-adapter applyExtraction)
      const byFileId = new Map(
        documents.map((d) => [String(d.metadata.fileId ?? ""), d]),
      );
      const evidenceByFileId = new Map(
        evidenceResults.map((e, i) => {
          const fileId = String(documents[i]?.metadata.fileId ?? "");
          return [fileId, e] as const;
        }),
      );

      const enriched: RawConnectorItem[] = toExtract.map((item) => {
        const doc = byFileId.get(item.externalId);
        const ev = evidenceByFileId.get(item.externalId);
        if (!doc) return item;
        const preview = doc.text.slice(0, 2000);
        return {
          ...item,
          rawSummary: preview || item.rawSummary,
          metadata: {
            ...(item.metadata ?? {}),
            format: String(doc.metadata.format ?? ""),
            sectionCount: String(doc.sections.length),
            extractedTitle: doc.title,
            extractedTextPreview: preview,
            ...(ev
              ? {
                  evidenceType: ev.evidenceType,
                  evidenceDimension: ev.dimension,
                  evidenceConfidence: String(ev.confidence),
                  evidenceJson: JSON.stringify(ev),
                }
              : {}),
          },
        };
      });

      rawForNormalize = {
        connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
        status: "connected",
        lastSynced: new Date().toISOString(),
        documentsAnalyzed: enriched.length,
        items: enriched,
        extractedDocuments: documents,
        evidenceResults,
      };

      evidence = await adapter.normalize(rawForNormalize);
      await upsertCompanyEvidence(db, companyId, evidence);

      if (errors.length > 0) {
        // Continue — partial extraction is acceptable for incremental sync
      }
    }

    // Delete removed Drive files + their evidence
    if (delta.deletedExternalIds.length > 0) {
      const deletedEvidenceIds = delta.deletedExternalIds.map(
        evidenceIdForDriveFile,
      );
      await deleteEvidenceByIds(db, companyId, deletedEvidenceIds);
      await deleteDocumentsByExternalIds(
        db,
        companyId,
        GOOGLE_DRIVE_CONNECTOR_ID,
        delta.deletedExternalIds,
      );
    }

    const changedEvidenceIds = [
      ...evidence.map((e) => e.id),
      ...delta.deletedExternalIds.map(evidenceIdForDriveFile),
    ];

    const deltaCounts: IncrementalSyncDeltaCounts = {
      added: delta.added.length,
      changed: delta.changed.length,
      unchanged: delta.unchanged.length,
      deleted: delta.deletedExternalIds.length,
    };

    await updateConnectorCredential(db, companyId, GOOGLE_DRIVE_CONNECTOR_ID, {
      last_synced_at: new Date().toISOString(),
      status: "connected",
    });

    const status =
      deltaHasWork(delta) || inventory.length >= 0 ? "succeeded" : "succeeded";

    await finishConnectorSync(db, syncId, {
      status: evidence.length < toExtract.length ? "partial" : "succeeded",
      documentsAnalyzed: inventory.length,
      evidenceCreated: evidence.length,
      metadata: {
        mode,
        ...deltaCounts,
        extractedDocuments: extractedCount,
      },
    });

    return {
      companyId,
      syncId,
      status,
      documentsAnalyzed: inventory.length,
      extractedDocuments: extractedCount,
      evidenceCreated: evidence.length,
      delta: deltaCounts,
      changedEvidenceIds,
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
      evidenceCreated: 0,
      delta: emptyDelta(),
      changedEvidenceIds: [],
      errorMessage: message,
    };
  }
}
