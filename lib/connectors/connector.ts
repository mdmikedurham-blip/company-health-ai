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
  | "dropbox"
  | "jira"
  | (string & {});

/**
 * Opaque payload returned by sync().
 * Each system shapes `items` differently; normalize() turns this into Evidence[].
 */
export interface RawConnectorItem {
  /** Connector-native file id. */
  externalId: string;
  title: string;
  syncedAt: string;
  rawSummary: string;
  /** Logical path / name within the source system. */
  path?: string;
  /** Last modified timestamp (ISO-8601) in the source system. */
  modifiedAt?: string;
  /** Display name or email of the primary owner. */
  owner?: string;
  mimeType?: string;
  /** Content fingerprint for change detection (md5/sha1/etc.). */
  contentHash?: string;
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

/** Runtime health snapshot from health(). */
export interface ConnectorHealth {
  status: ConnectorStatus;
  ok: boolean;
  lastSynced: string;
  documentsAnalyzed: number;
  message?: string;
}

/**
 * Canonical connector adapter — the only ingestion boundary.
 *
 * ```ts
 * interface ConnectorAdapter {
 *   connect(): Promise<void>;
 *   sync(): Promise<RawConnectorData>;
 *   normalize(raw: RawConnectorData): Promise<Evidence[]>;
 *   health(): Promise<ConnectorHealth>;
 *   disconnect(): Promise<void>;
 * }
 * ```
 */
export interface ConnectorAdapter {
  connectorId: string;
  name: string;
  system: string;
  /** Current connection status (updated by connect / disconnect). */
  status: ConnectorStatus;
  connect(): Promise<void>;
  sync(): Promise<RawConnectorData>;
  normalize(raw: RawConnectorData): Promise<Evidence[]>;
  health(): Promise<ConnectorHealth>;
  disconnect(): Promise<void>;
}

/**
 * Sync surface for mock adapters used at module-init time.
 * Production OAuth adapters implement only the async ConnectorAdapter methods.
 */
export interface SyncConnectorAdapter extends ConnectorAdapter {
  syncSync(): RawConnectorData;
  normalizeSync(raw: RawConnectorData): Evidence[];
  healthSync(): ConnectorHealth;
}

export function isSyncConnectorAdapter(
  adapter: ConnectorAdapter,
): adapter is SyncConnectorAdapter {
  return (
    typeof (adapter as SyncConnectorAdapter).syncSync === "function" &&
    typeof (adapter as SyncConnectorAdapter).normalizeSync === "function" &&
    typeof (adapter as SyncConnectorAdapter).healthSync === "function"
  );
}

export interface ConnectorIngestResult {
  evidence: Evidence[];
  rawResults: RawConnectorData[];
}
