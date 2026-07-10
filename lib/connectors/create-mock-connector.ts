import type { ConnectorStatus } from "@/lib/domain";
import type { RawEvidence } from "@/lib/engine";
import type {
  ConnectorDocument,
  ConnectorId,
  ConnectorSyncResult,
  HealthConnector,
} from "./types";

export interface MockEvidenceMapping {
  externalId: string;
  evidence: RawEvidence;
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
 * Factory for mock connector adapters.
 * Each mapping pairs an external document ID with its normalized evidence.
 */
export function createMockConnector(config: MockConnectorConfig): HealthConnector {
  const documentByExternalId = new Map(
    config.mappings.map((m) => [m.externalId, m]),
  );

  return {
    id: config.id,
    name: config.name,
    system: config.system,
    status: config.status,

    sync(): ConnectorSyncResult {
      const documents: ConnectorDocument[] = config.mappings.map((m) => ({
        externalId: m.externalId,
        title: m.evidence.documentName,
        syncedAt: m.evidence.lastReviewed,
        rawSummary: m.evidence.summary,
      }));

      return {
        connectorId: config.id,
        name: config.name,
        system: config.system,
        status: config.status,
        lastSynced: config.lastSynced,
        documentsAnalyzed: config.documentsAnalyzed,
        documents,
      };
    },

    normalize(document: ConnectorDocument): RawEvidence {
      const mapping = documentByExternalId.get(document.externalId);
      if (!mapping) {
        throw new Error(
          `Unknown document ${document.externalId} for connector ${config.id}`,
        );
      }
      return mapping.evidence;
    },
  };
}
