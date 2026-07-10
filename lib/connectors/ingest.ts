import type { EvidenceCatalog } from "@/lib/domain";
import type { RawEvidence } from "@/lib/engine";
import type { ConnectorIngestResult, ConnectorSyncResult, HealthConnector } from "./types";

/**
 * Run all connectors, normalize documents, and merge into a single evidence corpus.
 * This is the ingestion entry point — UI never calls connectors directly.
 */
export function ingestFromConnectors(connectors: HealthConnector[]): ConnectorIngestResult {
  const syncResults = connectors.map((connector) => connector.sync());

  const evidence = syncResults.flatMap((result) =>
    result.documents.map((doc) => {
      const connector = connectors.find((c) => c.id === result.connectorId);
      if (!connector) {
        throw new Error(`Connector ${result.connectorId} not registered`);
      }
      return connector.normalize(doc);
    }),
  );

  return { evidence, connectors: syncResults };
}

/** Build EvidenceCatalog from connector sync metadata. */
export function buildEvidenceCatalog(
  syncResults: ConnectorSyncResult[],
  lastFullScan: string,
): EvidenceCatalog {
  const connected = syncResults.filter((r) => r.status === "connected");

  return {
    totalDocuments: connected.reduce((sum, r) => sum + r.documentsAnalyzed, 0),
    systemsConnected: connected.length,
    lastFullScan,
    connectors: syncResults.map((r) => ({
      id: `conn-${r.connectorId}`,
      name: r.name,
      system: r.system,
      documentsAnalyzed: r.documentsAnalyzed,
      lastSynced: r.lastSynced,
    })),
  };
}

export interface ConnectorPipelineInput {
  connectors: HealthConnector[];
  lastFullScan: string;
}

export interface ConnectorPipelineOutput {
  evidence: RawEvidence[];
  evidenceCatalog: EvidenceCatalog;
}

/** Ingest + catalog — ready to feed the Insight Engine. */
export function runConnectorPipeline(
  input: ConnectorPipelineInput,
): ConnectorPipelineOutput {
  const { evidence, connectors } = ingestFromConnectors(input.connectors);

  return {
    evidence,
    evidenceCatalog: buildEvidenceCatalog(connectors, input.lastFullScan),
  };
}
