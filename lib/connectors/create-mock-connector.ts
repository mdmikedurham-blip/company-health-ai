import type { ConnectorStatus, Evidence } from "@/lib/domain";
import { evidenceFromRawItem, evidenceToRawMetadata } from "./normalize-evidence";
import type {
  ConnectorHealth,
  ConnectorId,
  RawConnectorData,
  SyncConnectorAdapter,
} from "./connector";

export interface MockEvidenceMapping {
  externalId: string;
  evidence: Evidence;
}

export interface MockConnectorConfig {
  id: ConnectorId;
  name: string;
  system: string;
  status: ConnectorStatus;
  lastSynced: string;
  documentsAnalyzed: number;
  mappings: MockEvidenceMapping[];
}

/**
 * Factory for mock ConnectorAdapters.
 * sync() emits raw items with metadata; normalize() rebuilds Evidence
 * via evidenceFromRawItem — same path a real API adapter would use.
 */
export function createMockConnector(config: MockConnectorConfig): SyncConnectorAdapter {
  let status: ConnectorStatus = config.status;

  function syncSync(): RawConnectorData {
    return {
      connectorId: config.id,
      status,
      lastSynced: config.lastSynced,
      documentsAnalyzed: status === "connected" ? config.documentsAnalyzed : 0,
      items:
        status === "connected"
          ? config.mappings.map((m) => ({
              externalId: m.externalId,
              title: m.evidence.title,
              syncedAt: m.evidence.collectedAt,
              rawSummary: m.evidence.contentSummary,
              metadata: evidenceToRawMetadata(m.evidence),
            }))
          : [],
    };
  }

  function normalizeSync(raw: RawConnectorData): Evidence[] {
    if (raw.status !== "connected") return [];
    return raw.items.map((item) => evidenceFromRawItem(item));
  }

  function healthSync(): ConnectorHealth {
    return {
      status,
      ok: status === "connected",
      lastSynced: config.lastSynced,
      documentsAnalyzed: status === "connected" ? config.documentsAnalyzed : 0,
      message:
        status === "connected"
          ? undefined
          : `${config.name} is not connected`,
    };
  }

  return {
    connectorId: config.id,
    name: config.name,
    system: config.system,
    get status() {
      return status;
    },
    async connect(): Promise<void> {
      status = "connected";
    },
    async disconnect(): Promise<void> {
      status = "pending";
    },
    syncSync,
    normalizeSync,
    healthSync,
    async sync(): Promise<RawConnectorData> {
      return syncSync();
    },
    async normalize(raw: RawConnectorData): Promise<Evidence[]> {
      return normalizeSync(raw);
    },
    async health(): Promise<ConnectorHealth> {
      return healthSync();
    },
  };
}
