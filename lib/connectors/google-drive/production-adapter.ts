/**
 * Production Google Drive ConnectorAdapter.
 * Uses OAuth refresh tokens + Drive files.list (read-only).
 * Mock demo data remains in adapter.ts for the static Acme snapshot.
 */
import type { Evidence } from "@/lib/domain";
import type {
  ConnectorAdapter,
  ConnectorHealth,
  RawConnectorData,
} from "../connector";
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

export interface GoogleDriveAdapterOptions {
  companyId: string;
  crawlOptions?: GoogleDriveCrawlOptions;
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
    async sync(): Promise<RawConnectorData> {
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
        };
      }

      const items = await crawlGoogleDrive(
        credentials.accessToken,
        options.crawlOptions,
      );
      status = "connected";
      lastSynced = new Date().toISOString();
      documentsAnalyzed = items.length;
      lastMessage = undefined;

      return {
        connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
        status,
        lastSynced,
        documentsAnalyzed,
        items,
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
