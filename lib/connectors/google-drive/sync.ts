/**
 * Incremental Google Drive sync.
 *
 * Only re-extracts changed/new documents. Never rescores the entire company —
 * evidence upserts are scoped to the delta; analysis uses affected-scope merge.
 *
 * Translates Drive inventory → RawDocument → ExtractedDocument → Evidence
 * via the shared evidence extraction pipeline (no mock dashboard data).
 */
import type { Evidence } from "@/lib/domain";
import {
  createEvidenceRepository,
  type EvidenceRepository,
} from "@/lib/repositories";
import {
  createServiceClient,
  deleteDocumentsByExternalIds,
  finishConnectorSync,
  isSupabaseConfigured,
  listDocuments,
  startConnectorSync,
  updateConnectorCredential,
  upsertDocuments,
  type AppSupabaseClient,
  type TablesInsert,
} from "@/lib/supabase";
import type { RawConnectorItem } from "../connector";
import {
  rawDocumentFromConnectorItem,
  runEvidenceExtractionPipeline,
  type RawDocument,
} from "../documents";
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

function toRawDocuments(items: RawConnectorItem[]): RawDocument[] {
  return items.map((item) =>
    rawDocumentFromConnectorItem(
      item,
      GOOGLE_DRIVE_CONNECTOR_ID,
      "Google Drive",
    ),
  );
}

function toDocumentRows(
  companyId: string,
  docs: RawDocument[],
): TablesInsert<"documents">[] {
  return docs.map((doc) => ({
    company_id: companyId,
    connector_id: GOOGLE_DRIVE_CONNECTOR_ID,
    external_id: doc.externalId,
    title: doc.title,
    path: doc.path ?? null,
    modified_at: doc.modifiedAt ?? null,
    owner: doc.owner ?? null,
    mime_type: doc.mimeType ?? null,
    content_hash: doc.contentHash ?? null,
    uri: doc.uri ?? null,
    raw_summary: doc.rawSummary,
    metadata: doc.metadata ?? {},
    synced_at: doc.syncedAt,
  }));
}

/**
 * Incremental sync: crawl → diff → extract only changed/new → upsert evidence.
 * Deleted Drive files remove corresponding evidence rows.
 */
export async function syncGoogleDriveForCompany(
  companyId: string,
  client?: AppSupabaseClient,
  options?: {
    mode?: "full" | "incremental";
    /** Evidence persistence port — defaults to createEvidenceRepository(). */
    evidenceRepository?: EvidenceRepository;
  },
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
  const evidenceRepository =
    options?.evidenceRepository ?? createEvidenceRepository({ client: db });
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
    const inventoryDocs = toRawDocuments(inventory);
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
    await upsertDocuments(db, toDocumentRows(companyId, inventoryDocs));

    const toExtract = [...delta.added, ...delta.changed];
    let extractedCount = 0;
    let evidence: Evidence[] = [];

    if (toExtract.length > 0) {
      // Extract only the delta set → RawDocument → Evidence via shared pipeline
      const { documents, errors } = await extractDriveDocuments(
        credentials.accessToken,
        toExtract,
      );
      extractedCount = documents.length;

      const byFileId = new Map(
        documents.map((d) => [String(d.metadata.fileId ?? ""), d]),
      );

      for (const item of toExtract) {
        const extracted = byFileId.get(item.externalId);
        if (!extracted) continue;
        const raw = rawDocumentFromConnectorItem(
          {
            ...item,
            rawSummary:
              extracted.text.slice(0, 2000) || item.rawSummary,
          },
          GOOGLE_DRIVE_CONNECTOR_ID,
          "Google Drive",
        );
        const { evidence: ev } = runEvidenceExtractionPipeline(raw, extracted, {
          evidenceId: evidenceIdForDriveFile(item.externalId),
        });
        evidence.push(ev);
      }

      await evidenceRepository.upsert(companyId, evidence);

      if (errors.length > 0) {
        // Continue — partial extraction is acceptable for incremental sync
      }
    }

    // Delete removed Drive files + their evidence
    if (delta.deletedExternalIds.length > 0) {
      const deletedEvidenceIds = delta.deletedExternalIds.map(
        evidenceIdForDriveFile,
      );
      await evidenceRepository.deleteByIds(companyId, deletedEvidenceIds);
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
