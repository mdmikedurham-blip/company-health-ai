import type {
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  Evidence,
  EvidenceCatalog,
  ExecutiveBrief,
  Finding,
  HealthDimension,
  HealthScore,
  Insight,
  Recommendation,
  Report,
  Risk,
  ScoreChangeExplanation,
  TimelineEvent,
} from "@/lib/domain";
import type { EvidenceId, FindingId, RecommendationId, RiskId } from "@/lib/domain";

/** Evidence as delivered by a connector — before engine enrichment. */
export type RawEvidence = Omit<Evidence, "findingIds" | "linkedRiskIds">;

export interface FindingExtractionRule {
  evidenceId: EvidenceId;
  finding: Omit<Finding, "evidenceIds">;
}

export interface InsightSynthesisRule {
  insight: Omit<Insight, "findingIds">;
  findingIds: FindingId[];
}

export interface RiskAssessmentRule {
  risk: Omit<Risk, "evidenceIds" | "findingIds" | "recommendationId">;
  findingIds: FindingId[];
  recommendationId: RecommendationId;
}

export interface RecommendationGenerationRule {
  recommendation: Omit<Recommendation, "supportingEvidenceIds" | "findingIds">;
  findingIds: FindingId[];
}

/**
 * Declarative rule set for a company's evidence corpus.
 * Connectors supply evidence; rules define how findings are extracted.
 * Production: rules become ML prompts or per-connector parsers.
 */
export interface InsightEngineRules {
  findingExtractions: FindingExtractionRule[];
  insightRules: InsightSynthesisRule[];
  riskRules: RiskAssessmentRule[];
  recommendationRules: RecommendationGenerationRule[];
}

/**
 * Input to the Insight Engine — raw connector output plus static company config.
 * Downstream entities (findings, risks, etc.) are computed, not hand-authored.
 */
export interface InsightEngineInput {
  company: Company;
  evidence: RawEvidence[];
  evidenceCatalog: EvidenceCatalog;
  /** Dimension profiles with scores and metadata; engine wires evidence/finding links. */
  dimensions: HealthDimension[];
  healthScore: HealthScore;
  scoreChange: ScoreChangeExplanation;
  dna: CompanyDNA;
  reports: Report[];
  timeline: TimelineEvent[];
  executiveBrief: ExecutiveBrief;
  rules: InsightEngineRules;
}

export interface PipelineResult {
  findings: Finding[];
  insights: Insight[];
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  dimensions: HealthDimension[];
  healthScore: HealthScore;
}

export type { CompanyHealthSnapshot };
