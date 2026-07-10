/**
 * Application orchestration — sits between connectors and the Insight Engine.
 *
 * Connectors emit Evidence only. This layer runs analysis and assembles snapshots.
 */

export {
  analyzeAndPersistCompany,
  analyzeCompanyFromStoredEvidence,
  buildCompanyHealthSnapshot,
  buildCompanyHealthSnapshotFromSyncAdapters,
} from "./company-analysis-service";
export type { PlatformInput } from "./company-analysis-service";
export { buildExecutiveBrief } from "./build-brief";
export type { BriefSeed } from "./build-brief";
export { buildEvidenceGraph } from "./evidence-graph";
