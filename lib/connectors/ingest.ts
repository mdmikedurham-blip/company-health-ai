import type { Evidence, EvidenceCatalog } from "@/lib/domain";
import type {
  ConnectorAdapter,
  ConnectorIngestResult,
  RawConnectorData,
} from "./connector";

/**
 * Canonical ingest — sync() → normalize() → Evidence[] for every adapter.
 */
export async function ingestFromConnectors(
  connectors: ConnectorAdapter[],
): Promise<ConnectorIngestResult> {
  const rawResults: RawConnectorData[] = [];
  const evidence: Evidence[] = [];

  for (const adapter of connectors) {
    const raw = await adapter.sync();
    rawResults.push(raw);
    const normalized = await adapter.normalize(raw);
    evidence.push(...normalized);
  }

  return { evidence, rawResults };
}

/** Build EvidenceCatalog from raw sync() results + adapter display metadata. */
export function buildEvidenceCatalog(
  adapters: ConnectorAdapter[],
  rawResults: RawConnectorData[],
  lastFullScan: string,
): EvidenceCatalog {
  const byId = new Map(adapters.map((a) => [a.connectorId, a]));
  const connected = rawResults.filter((r) => r.status === "connected");

  return {
    totalDocuments: connected.reduce((sum, r) => sum + r.documentsAnalyzed, 0),
    systemsConnected: connected.length,
    lastFullScan,
    connectors: rawResults.map((r) => {
      const adapter = byId.get(r.connectorId);
      return {
        id: `conn-${r.connectorId}`,
        name: adapter?.name ?? r.connectorId,
        system: adapter?.system ?? r.connectorId,
        documentsAnalyzed: r.documentsAnalyzed,
        lastSynced: r.lastSynced,
      };
    }),
  };
}

export interface ConnectorPipelineInput {
  connectors: ConnectorAdapter[];
  lastFullScan: string;
}

export interface ConnectorPipelineOutput {
  evidence: Evidence[];
  evidenceCatalog: EvidenceCatalog;
}

/** Canonical pipeline — ready to feed the Insight Engine. */
export async function runConnectorPipeline(
  input: ConnectorPipelineInput,
): Promise<ConnectorPipelineOutput> {
  const { evidence, rawResults } = await ingestFromConnectors(input.connectors);

  return {
    evidence,
    evidenceCatalog: buildEvidenceCatalog(
      input.connectors,
      rawResults,
      input.lastFullScan,
    ),
  };
}
