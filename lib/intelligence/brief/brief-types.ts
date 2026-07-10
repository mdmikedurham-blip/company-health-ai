export type {
  BriefActionItem,
  BriefBoardImplication,
  BriefPreviousSlice,
  BriefRiskItem,
  BriefScoreChange,
  BriefSeed,
  BusinessMateriality,
  CausalDriver,
  DimensionScoreDelta,
  ExecutiveBrief,
  ScoreDeltaResult,
} from "@/lib/domain/executive-brief";

export interface CausalAnalysis {
  scoreDelta: import("@/lib/domain/executive-brief").ScoreDeltaResult;
  drivers: import("@/lib/domain/executive-brief").CausalDriver[];
  primaryDrivers: import("@/lib/domain/executive-brief").CausalDriver[];
  secondaryDrivers: import("@/lib/domain/executive-brief").CausalDriver[];
  confidence: number;
  insufficientEvidence: boolean;
  conflictingEvidence: boolean;
}
