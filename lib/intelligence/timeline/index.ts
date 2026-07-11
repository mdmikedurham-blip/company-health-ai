export type {
  AnalysisDiff,
  CausalLinkMap,
  DimensionScoreDiff,
  DocumentDiff,
  FindingDiff,
  RiskDiff,
  TimelineDocument,
  TimelinePreviousSlice,
} from "./timeline-types";

export {
  diffAnalysis,
  diffDimensions,
  diffDocuments,
  diffEvidenceIds,
  diffFindings,
  diffRisks,
} from "./event-diff";

export {
  applySelfRoot,
  createLinkMap,
  inheritRootFromParent,
  pickParentForDimension,
  pickParentForEvidence,
  pickParentForFinding,
  pickParentForOverall,
  pickParentForRisk,
  resolveCausalLinks,
  stableChainId,
  stableEventId,
  timelineEventKey,
} from "./causal-linker";

export { buildCausalTimeline } from "./timeline-builder";
export type { BuildCausalTimelineInput } from "./timeline-builder";
