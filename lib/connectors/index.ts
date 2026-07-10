/**
 * Public connector surface.
 *
 * Canonical path: ConnectorAdapter.collect() → normalize() → buildCompanyHealthSnapshot().
 * Sync helpers are not exported — reserved for lib/data mock module-init.
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
export { buildEvidenceGraph } from "./graph";
export { buildCompanyHealthSnapshot } from "./pipeline";
export type { PlatformInput } from "./pipeline";
export { buildExecutiveBrief } from "./build-brief";
export type { BriefSeed } from "./build-brief";
export {
  acmeConnectors,
  getActiveConnectors,
  getAllConnectors,
  getConnector,
  registerConnector,
} from "./registry";
export type {
  ConnectorAdapter,
  ConnectorId,
  ConnectorIngestResult,
  RawConnectorData,
  RawConnectorItem,
} from "./types";
