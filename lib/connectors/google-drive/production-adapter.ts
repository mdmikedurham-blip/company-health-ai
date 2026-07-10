/**
 * Production Google Drive ConnectorAdapter.
 * Uses OAuth refresh tokens + Drive files.list (read-only).
 * Each supported file is downloaded/exported into an ExtractedDocument,
 * then evidence-extracted into JSON (EvidenceExtractionResult).
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
import type { EvidenceExtractionResult } from "../evidence-extraction";
import { evidenceFromRawExtractionItem } from "../evidence-extraction";
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
  evidenceResults?: EvidenceExtractionResult[];
};

function applyExtraction(
  item: RawConnectorItem,
  doc: ExtractedDocument,
  evidence?: EvidenceExtractionResult,
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
      ...(evidence
        ? {
            evidenceType: evidence.evidenceType,
            evidenceDimension: evidence.dimension,
            evidenceConfidence: String(evidence.confidence),
            evidenceJson: JSON.stringify(evidence),
          }
        : {}),
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
          evidenceResults: [],
        };
      }

      const inventory = await crawlGoogleDrive(
        credentials.accessToken,
        options.crawlOptions,
      );

      let items = inventory;
      let extractedDocuments: ExtractedDocument[] = [];
      let evidenceResults: EvidenceExtractionResult[] = [];

      if (options.extractContent !== false && inventory.length > 0) {
        const result = await extractDriveDocuments(
          credentials.accessToken,
          inventory,
        );
        extractedDocuments = result.documents;
        evidenceResults = result.evidenceResults;
        const byFileId = new Map(
          result.documents.map((d) => [String(d.metadata.fileId ?? ""), d]),
        );
        const evidenceByFileId = new Map(
          result.evidenceResults.map((e, i) => {
            const fileId = String(
              result.documents[i]?.metadata.fileId ?? "",
            );
            return [fileId, e] as const;
          }),
        );
        items = inventory.map((item) => {
          const doc = byFileId.get(item.externalId);
          if (!doc) return item;
          return applyExtraction(
            item,
            doc,
            evidenceByFileId.get(item.externalId),
          );
        });
        if (result.errors.length > 0) {
          lastMessage = `Extracted ${result.documents.length}/${inventory.length}; ${result.errors.length} failed`;
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
        evidenceResults,
      };
    },
    async normalize(raw: RawConnectorData): Promise<Evidence[]> {
      if (raw.status !== "connected") return [];
      const evidence: Evidence[] = [];
      for (const item of raw.items) {
        const fromExtraction = evidenceFromRawExtractionItem(item);
        if (fromExtraction) {
          evidence.push(fromExtraction);
          continue;
        }
        if (item.metadata?.evidenceId) {
          evidence.push(evidenceFromRawItem(item));
        }
      }
      return evidence;
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
