/**
 * Production Google Drive ConnectorAdapter.
 * Uses OAuth refresh tokens + Drive files.list (read-only).
 * Each supported file is downloaded/exported into an ExtractedDocument.
 * Mock demo data remains in adapter.ts for the static Acme snapshot.
 */
import type { Evidence } from "@/lib/domain";
import type {
  ConnectorAdapter,
  ConnectorHealth,
  RawConnectorData,
  RawConnectorItem,
} from "../connector";
import type { ExtractedDocument } from "../extraction";
import { evidenceFromRawItem } from "../normalize-evidence";
import {
  getConnectorConnectionStatus,
  isSupabaseConfigured,
  createServiceClient,
} from "@/lib/supabase";
import {
  disconnectGoogleDrive,
  getGoogleDriveCredentials,
} from "./auth";
import { GOOGLE_DRIVE_CONNECTOR_ID } from "./constants";
import { crawlGoogleDrive, type GoogleDriveCrawlOptions } from "./crawler";
import { extractDriveDocuments } from "./extract";

export interface GoogleDriveAdapterOptions {
  companyId: string;
  crawlOptions?: GoogleDriveCrawlOptions;
  /** When false, skip download/export extraction (inventory only). Default true. */
  extractContent?: boolean;
}

export type GoogleDriveRawConnectorData = RawConnectorData & {
  extractedDocuments?: ExtractedDocument[];
};

function applyExtraction(
  item: RawConnectorItem,
  doc: ExtractedDocument,
): RawConnectorItem {
  const preview = doc.text.slice(0, 2000);
  return {
    ...item,
    rawSummary:
      preview || item.rawSummary || `Google Drive file: ${item.title}`,
    metadata: {
      ...(item.metadata ?? {}),
      format: String(doc.metadata.format ?? ""),
      sectionCount: String(doc.sections.length),
      extractedTitle: doc.title,
      extractedTextPreview: preview,
    },
  };
}

export function createGoogleDriveAdapter(
  options: GoogleDriveAdapterOptions,
): ConnectorAdapter {
  let status: ConnectorAdapter["status"] = "pending";
  let lastSynced = "Never";
  let documentsAnalyzed = 0;
  let lastMessage: string | undefined;

  return {
    connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
    name: "Google Drive",
    system: "Google Drive",
    get status() {
      return status;
    },
    async connect(): Promise<void> {
      const credentials = await getGoogleDriveCredentials({
        companyId: options.companyId,
      });
      if (!credentials) {
        status = "pending";
        lastMessage = "Google Drive is not connected";
        throw new Error(lastMessage);
      }
      status = "connected";
      lastMessage = undefined;
    },
    async disconnect(): Promise<void> {
      await disconnectGoogleDrive({ companyId: options.companyId });
      status = "pending";
      documentsAnalyzed = 0;
      lastSynced = "Never";
      lastMessage = "Disconnected";
    },
    async sync(): Promise<GoogleDriveRawConnectorData> {
      const credentials = await getGoogleDriveCredentials({
        companyId: options.companyId,
      });
      if (!credentials) {
        status = "pending";
        return {
          connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
          status,
          lastSynced,
          documentsAnalyzed: 0,
          items: [],
          extractedDocuments: [],
        };
      }

      const inventory = await crawlGoogleDrive(
        credentials.accessToken,
        options.crawlOptions,
      );

      let items = inventory;
      let extractedDocuments: ExtractedDocument[] = [];

      if (options.extractContent !== false && inventory.length > 0) {
        const { documents, errors } = await extractDriveDocuments(
          credentials.accessToken,
          inventory,
        );
        extractedDocuments = documents;
        const byFileId = new Map(
          documents.map((d) => [String(d.metadata.fileId ?? ""), d]),
        );
        items = inventory.map((item) => {
          const doc = byFileId.get(item.externalId);
          return doc ? applyExtraction(item, doc) : item;
        });
        if (errors.length > 0) {
          lastMessage = `Extracted ${documents.length}/${inventory.length}; ${errors.length} failed`;
        } else {
          lastMessage = undefined;
        }
      }

      status = "connected";
      lastSynced = new Date().toISOString();
      documentsAnalyzed = items.length;

      return {
        connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
        status,
        lastSynced,
        documentsAnalyzed,
        items,
        extractedDocuments,
      };
    },
    async normalize(raw: RawConnectorData): Promise<Evidence[]> {
      if (raw.status !== "connected") return [];
      return raw.items.map((item) => evidenceFromRawItem(item));
    },
    async health(): Promise<ConnectorHealth> {
      if (isSupabaseConfigured()) {
        const connection = await getConnectorConnectionStatus(
          createServiceClient(),
          options.companyId,
          GOOGLE_DRIVE_CONNECTOR_ID,
        );
        const ok = connection?.status === "connected";
        status = ok ? "connected" : "pending";
        if (connection?.lastSyncedAt) {
          lastSynced = connection.lastSyncedAt;
        }
        return {
          status,
          ok,
          lastSynced,
          documentsAnalyzed,
          message: ok
            ? connection.accountEmail
              ? `Connected as ${connection.accountEmail}`
              : lastMessage
            : "Google Drive is not connected",
        };
      }

      status = "pending";
      return {
        status,
        ok: false,
        lastSynced,
        documentsAnalyzed,
        message: "Google Drive is not connected",
      };
    },
  };
}
