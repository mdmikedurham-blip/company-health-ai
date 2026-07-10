/**
 * Public connector surface.
 *
 * Canonical path: ConnectorAdapter.sync() → normalize() → Evidence[].
 * Insight Engine orchestration lives in `@/lib/application` — not here.
 */

export { createEvidence } from "./create-evidence";
export type { EvidenceInput } from "./create-evidence";
export { createMockConnector } from "./create-mock-connector";
export type { MockConnectorConfig, MockEvidenceMapping } from "./create-mock-connector";
export {
  evidenceFromRawItem,
  evidenceToRawMetadata,
} from "./normalize-evidence";
export {
  buildEvidenceCatalog,
  ingestFromConnectors,
  runConnectorPipeline,
} from "./ingest";
export {
  acmeConnectors,
  getActiveConnectors,
  getAllConnectors,
  getConnector,
  registerConnector,
} from "./registry";
export type {
  ConnectorAdapter,
  ConnectorHealth,
  ConnectorId,
  ConnectorIngestResult,
  RawConnectorData,
  RawConnectorItem,
} from "./connector";
