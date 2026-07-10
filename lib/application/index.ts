/**
 * Application orchestration — sits between connectors and the Insight Engine.
 *
 * Connectors emit Evidence only. This layer loads Evidence via EvidenceRepository,
 * runs analysis, and assembles snapshots.
 */

export {
  analyzeAndPersistCompany,
  analyzeAndPersistFromStoredEvidence,
  analyzeCompanyFromStoredEvidence,
  buildCompanyHealthSnapshot,
  buildCompanyHealthSnapshotFromSyncAdapters,
  syncStoreAndAnalyzeCompany,
} from "./company-analysis-service";
export type { PlatformInput } from "./company-analysis-service";
export {
  analyzeAndPersistIncremental,
  shouldRescoreIncremental,
} from "./incremental-analysis";
export type { IncrementalAnalyzeInput } from "./incremental-analysis";
export {
  ingestEvidenceAndAnalyze,
  runInsightEngineFromRepository,
} from "./insight-from-repository";
export type { RunInsightEngineFromRepositoryInput } from "./insight-from-repository";
export { buildExecutiveBrief } from "./build-brief";
export type { BriefSeed } from "./build-brief";
export { buildEvidenceGraph } from "./evidence-graph";
