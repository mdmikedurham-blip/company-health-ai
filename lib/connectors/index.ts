/**
 * Public connector surface.
 *
 * Canonical path:
 *   ConnectorAdapter.sync() → RawDocument / RawConnectorData
 *     → ExtractedDocument → EvidenceCandidate → Evidence[]
 *
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
  ConnectorRegistry,
  acmeConnectors,
  defaultConnectorRegistry,
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
export {
  connectorItemFromRawDocument,
  evidenceFromCandidate,
  rawDocumentFromConnectorItem,
  rawDocumentsFromConnectorItems,
  runEvidenceExtractionPipeline,
  runEvidenceExtractionPipelineBatch,
  toEvidenceCandidate,
} from "./documents";
export type {
  EvidenceCandidate,
  ExtractEvidencePipelineOptions,
  RawDocument,
} from "./documents";
export {
  extractDocument,
  extractCsv,
  extractDocx,
  extractGoogleDocs,
  extractGoogleSheets,
  extractGoogleSlides,
  extractMarkdown,
  extractPdf,
  extractTxt,
  isExtractableMimeType,
} from "./extraction";
export type {
  DocumentSection,
  ExtractDocumentInput,
  ExtractedDocument,
  ExtractableMimeType,
} from "./extraction";
export {
  extractEvidence,
  extractEvidenceJson,
  evidenceFromExtraction,
  evidenceFromRawExtractionItem,
  EVIDENCE_TYPES,
} from "./evidence-extraction";
export type {
  EvidenceExtractionResult,
  EvidenceExtractionType,
  ExtractedAmount,
  ExtractedDate,
  ExtractedPerson,
  RecommendedFinding,
  SourceQuote,
} from "./evidence-extraction";
