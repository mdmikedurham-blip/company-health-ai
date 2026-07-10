import type { ConnectorStatus, Evidence } from "@/lib/domain";

/**
 * Connector identifiers. Known systems are listed; string allows future
 * Salesforce, Jira, etc. without changing the interface.
 */
export type ConnectorId =
  | "google-drive"
  | "hubspot"
  | "carta"
  | "quickbooks"
  | "box"
  | "slack"
  | "bamboohr"
  | "salesforce"
  | "jira"
  | (string & {});

/**
 * Opaque payload returned by collect().
 * Each system shapes `items` differently; normalize() turns this into Evidence[].
 */
export interface RawConnectorItem {
  externalId: string;
  title: string;
  syncedAt: string;
  rawSummary: string;
  mimeType?: string;
  /** Structured fields for normalize() — never a pre-built Evidence object. */
  metadata?: Record<string, string>;
}

export interface RawConnectorData {
  connectorId: string;
  status: ConnectorStatus;
  lastSynced: string;
  /** Total documents indexed in this system (may exceed normalized evidence count). */
  documentsAnalyzed: number;
  items: RawConnectorItem[];
}

/**
 * Canonical connector adapter — the only ingestion boundary.
 *
 * ```ts
 * interface ConnectorAdapter {
 *   connectorId: string;
 *   collect(): Promise<RawConnectorData>;
 *   normalize(raw: RawConnectorData): Promise<Evidence[]>;
 * }
 * ```
 */
export interface ConnectorAdapter {
  connectorId: string;
  name: string;
  system: string;
  status: ConnectorStatus;
  collect(): Promise<RawConnectorData>;
  normalize(raw: RawConnectorData): Promise<Evidence[]>;
}

/**
 * Sync surface for mock adapters used at module-init time.
 * Production OAuth adapters implement only the async ConnectorAdapter methods.
 */
export interface SyncConnectorAdapter extends ConnectorAdapter {
  collectSync(): RawConnectorData;
  normalizeSync(raw: RawConnectorData): Evidence[];
}

export function isSyncConnectorAdapter(
  adapter: ConnectorAdapter,
): adapter is SyncConnectorAdapter {
  return (
    typeof (adapter as SyncConnectorAdapter).collectSync === "function" &&
    typeof (adapter as SyncConnectorAdapter).normalizeSync === "function"
  );
}

export interface ConnectorIngestResult {
  evidence: Evidence[];
  rawResults: RawConnectorData[];
}
