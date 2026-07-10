export { createMockConnector } from "./create-mock-connector";
export type { MockConnectorConfig, MockEvidenceMapping } from "./create-mock-connector";
export {
  buildEvidenceCatalog,
  ingestFromConnectors,
  runConnectorPipeline,
} from "./ingest";
export { buildEvidenceGraph } from "./graph";
export { buildCompanyHealthSnapshot } from "./pipeline";
export type { PlatformInput } from "./pipeline";
export {
  acmeConnectors,
  getActiveConnectors,
  getAllConnectors,
  getConnector,
} from "./registry";
export type {
  ConnectorDocument,
  ConnectorId,
  ConnectorIngestResult,
  ConnectorSyncResult,
  HealthConnector,
} from "./types";
