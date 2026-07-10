/**
 * @internal Sync ingest for mock adapters at module-init time.
 * Not part of the public ConnectorAdapter contract — production uses async only.
 */

import type { Evidence, EvidenceCatalog } from "@/lib/domain";
import type {
  ConnectorAdapter,
  ConnectorIngestResult,
  RawConnectorData,
  SyncConnectorAdapter,
} from "./connector";
import { isSyncConnectorAdapter } from "./connector";
import { buildEvidenceCatalog } from "./ingest";

export function ingestFromConnectorsSync(
  connectors: SyncConnectorAdapter[],
): ConnectorIngestResult {
  const rawResults: RawConnectorData[] = [];
  const evidence: Evidence[] = [];

  for (const adapter of connectors) {
    const raw = adapter.syncSync();
    rawResults.push(raw);
    evidence.push(...adapter.normalizeSync(raw));
  }

  return { evidence, rawResults };
}

export function runConnectorPipelineSync(input: {
  connectors: SyncConnectorAdapter[];
  lastFullScan: string;
}): { evidence: Evidence[]; evidenceCatalog: EvidenceCatalog } {
  const { evidence, rawResults } = ingestFromConnectorsSync(input.connectors);

  return {
    evidence,
    evidenceCatalog: buildEvidenceCatalog(
      input.connectors,
      rawResults,
      input.lastFullScan,
    ),
  };
}

export function requireSyncAdapters(
  connectors: ConnectorAdapter[],
): SyncConnectorAdapter[] {
  return connectors.map((adapter) => {
    if (!isSyncConnectorAdapter(adapter)) {
      throw new Error(
        `Connector ${adapter.connectorId} does not support sync ingest; use async runConnectorPipeline() instead`,
      );
    }
    return adapter;
  });
}
