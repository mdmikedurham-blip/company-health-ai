export type {
  BriefActionItem,
  BriefBoardImplication,
  BriefPreviousSlice,
  BriefRiskItem,
  BriefScoreChange,
  BriefSeed,
  BusinessMateriality,
  CausalAnalysis,
  CausalDriver,
  DimensionScoreDelta,
  ExecutiveBrief,
  ScoreDeltaResult,
} from "./brief-types";

export { analyzeCausalDrivers } from "./causal-analyzer";
export type { CausalAnalyzerInput } from "./causal-analyzer";
export { buildCausalExecutiveBrief } from "./brief-builder";
export type { BuildCausalBriefInput } from "./brief-builder";
export {
  computeWeightedScore,
  rankDrivers,
  splitPrimarySecondary,
} from "./driver-ranking";
export {
  buildDriverReason,
  deriveBusinessMateriality,
  materialityMultiplier,
  resolveDriverTitle,
} from "./materiality";
export { computeScoreDelta } from "./score-delta";
