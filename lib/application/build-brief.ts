/**
 * Application-layer brief entry — delegates to the Causal Brief Builder.
 */
import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import type {
  BriefPreviousSlice,
  BriefSeed,
  ExecutiveBrief,
} from "@/lib/domain/executive-brief";
import { buildCausalExecutiveBrief } from "@/lib/intelligence/brief";

export type { BriefSeed };

export function buildExecutiveBrief(params: {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  previous?: BriefPreviousSlice;
  seed: BriefSeed;
  asOf?: Date | string;
}): ExecutiveBrief {
  return buildCausalExecutiveBrief({
    healthScore: params.healthScore,
    dimensions: params.dimensions,
    findings: params.findings,
    risks: params.risks,
    recommendations: params.recommendations,
    evidence: params.evidence,
    timeline: params.timeline,
    previous: params.previous,
    seed: params.seed,
    asOf: params.asOf,
  });
}
