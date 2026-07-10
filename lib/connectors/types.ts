import type { ConnectorStatus } from "@/lib/domain";
import type { RawEvidence } from "@/lib/engine";

/** Supported external system identifiers. */
export type ConnectorId =
  | "google-drive"
  | "hubspot"
  | "carta"
  | "quickbooks"
  | "box"
  | "slack";

/**
 * Raw document as returned by an external system's API.
 * Connectors normalize this into domain RawEvidence.
 */
export interface ConnectorDocument {
  externalId: string;
  title: string;
  syncedAt: string;
  rawSummary: string;
  mimeType?: string;
  metadata?: Record<string, string>;
}

/** Result of a single connector sync operation. */
export interface ConnectorSyncResult {
  connectorId: ConnectorId;
  name: string;
  system: string;
  status: ConnectorStatus;
  lastSynced: string;
  /** Total documents indexed in this system (may exceed normalized evidence count). */
  documentsAnalyzed: number;
  documents: ConnectorDocument[];
}

/**
 * A connector adapter — the integration boundary for Phase 3.
 *
 * Production: `sync()` calls OAuth APIs (Drive, HubSpot, etc.).
 * Prototype: `sync()` returns seeded ConnectorDocuments.
 */
export interface HealthConnector {
  id: ConnectorId;
  name: string;
  system: string;
  status: ConnectorStatus;
  /** Pull documents from the external system. */
  sync(): ConnectorSyncResult;
  /** Map a connector document to domain evidence. */
  normalize(document: ConnectorDocument): RawEvidence;
}

export interface ConnectorIngestResult {
  evidence: RawEvidence[];
  connectors: ConnectorSyncResult[];
}
