import type { ConnectorStatus, Evidence } from "@/lib/domain";
import { evidenceFromRawItem, evidenceToRawMetadata } from "./normalize-evidence";
import type {
  ConnectorId,
  RawConnectorData,
  SyncConnectorAdapter,
} from "./types";

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
 * collect() emits raw items with metadata; normalize() rebuilds Evidence
 * via evidenceFromRawItem — same path a real API adapter would use.
 */
export function createMockConnector(config: MockConnectorConfig): SyncConnectorAdapter {
  function collectSync(): RawConnectorData {
    return {
      connectorId: config.id,
      status: config.status,
      lastSynced: config.lastSynced,
      documentsAnalyzed: config.documentsAnalyzed,
      items: config.mappings.map((m) => ({
        externalId: m.externalId,
        title: m.evidence.title,
        syncedAt: m.evidence.collectedAt,
        rawSummary: m.evidence.contentSummary,
        metadata: evidenceToRawMetadata(m.evidence),
      })),
    };
  }

  function normalizeSync(raw: RawConnectorData): Evidence[] {
    if (raw.status !== "connected") return [];
    return raw.items.map((item) => evidenceFromRawItem(item));
  }

  return {
    connectorId: config.id,
    name: config.name,
    system: config.system,
    status: config.status,
    collectSync,
    normalizeSync,
    async collect(): Promise<RawConnectorData> {
      return collectSync();
    },
    async normalize(raw: RawConnectorData): Promise<Evidence[]> {
      return normalizeSync(raw);
    },
  };
}
