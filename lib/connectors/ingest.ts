import type {
  ConnectedSystem,
  ConnectorSummary,
  Evidence,
  EvidenceCatalog,
} from "@/lib/domain";
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

/** Count of connectors currently in `connected` status. */
export function countConnectedSystems(
  connectors: Pick<ConnectorSummary, "status">[],
): number {
  return connectors.filter((c) => c.status === "connected").length;
}

/** Project catalog connectors into DNA ConnectedSystem rows. */
export function connectedSystemsFromCatalog(
  catalog: EvidenceCatalog,
): ConnectedSystem[] {
  return catalog.connectors.map((c) => ({
    name: c.name,
    status: c.status,
    documents: c.documentsAnalyzed,
  }));
}

/** Build EvidenceCatalog from raw sync() results + adapter display metadata. */
export function buildEvidenceCatalog(
  adapters: ConnectorAdapter[],
  rawResults: RawConnectorData[],
  lastFullScan: string,
): EvidenceCatalog {
  const byId = new Map(adapters.map((a) => [a.connectorId, a]));
  const connectors: ConnectorSummary[] = rawResults.map((r) => {
    const adapter = byId.get(r.connectorId);
    return {
      id: `conn-${r.connectorId}`,
      name: adapter?.name ?? r.connectorId,
      system: adapter?.system ?? r.connectorId,
      status: r.status,
      documentsAnalyzed: r.documentsAnalyzed,
      lastSynced: r.lastSynced,
    };
  });

  return {
    totalDocuments: connectors
      .filter((c) => c.status === "connected")
      .reduce((sum, c) => sum + c.documentsAnalyzed, 0),
    systemsConnected: countConnectedSystems(connectors),
    lastFullScan,
    connectors,
  };
}

/**
 * Single-connector catalog builder — same shape as multi-connector ingest.
 * Prefer this over hardcoding `systemsConnected: 1`.
 */
export function buildSingleConnectorCatalog(params: {
  connectorId: string;
  name: string;
  system: string;
  status?: ConnectorSummary["status"];
  documentsAnalyzed: number;
  lastSynced: string;
  lastFullScan: string;
}): EvidenceCatalog {
  const connectors: ConnectorSummary[] = [
    {
      id: `conn-${params.connectorId}`,
      name: params.name,
      system: params.system,
      status: params.status ?? "connected",
      documentsAnalyzed: params.documentsAnalyzed,
      lastSynced: params.lastSynced,
    },
  ];
  return {
    totalDocuments: params.documentsAnalyzed,
    systemsConnected: countConnectedSystems(connectors),
    lastFullScan: params.lastFullScan,
    connectors,
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
