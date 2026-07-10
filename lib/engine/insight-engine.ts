import type { CompanyHealthSnapshot } from "@/lib/domain";
import { assessRisks, generateRecommendations } from "./pipeline/assess-risks";
import {
  computeHealthScore,
  enrichDimensions,
  resolveScoreChange,
} from "./pipeline/compute-health";
import { extractFindings } from "./pipeline/extract-findings";
import { linkEvidence } from "./pipeline/link-evidence";
import { synthesizeInsights } from "./pipeline/synthesize-insights";
import type { InsightEngineInput } from "./types";

/**
 * Insight Engine — transforms connector evidence into actionable company health state.
 *
 * Pipeline:
 *   Evidence → Findings → Insights
 *                      → Recommendations → Risks
 *                      → Health Score (enriched dimensions)
 *
 * Future connectors push RawEvidence into this pipeline without UI changes.
 */
export function runInsightEngine(input: InsightEngineInput): CompanyHealthSnapshot {
  const { rules } = input;

  // Stage 1: Evidence → Findings
  const findings = extractFindings(input.evidence, rules.findingExtractions);

  // Stage 2: Findings → Insights
  const insights = synthesizeInsights(findings, rules.insightRules);

  // Stage 3: Findings → Recommendations (before risks so risks can link)
  const recommendations = generateRecommendations(
    findings,
    input.evidence,
    rules.recommendationRules,
  );

  // Stage 4: Findings → Risks
  const risks = assessRisks(
    findings,
    input.evidence,
    recommendations,
    rules.riskRules,
  );

  // Stage 5: Enrich dimensions + compute health score
  const dimensions = enrichDimensions(
    input.dimensions,
    findings,
    input.evidence,
    recommendations,
  );
  const healthScore = computeHealthScore(dimensions, input.evidence, input.healthScore);
  const scoreChange = resolveScoreChange(input.scoreChange, dimensions);

  // Stage 6: Link evidence ↔ findings ↔ risks
  const evidence = linkEvidence(input.evidence, findings, risks);

  return {
    company: input.company,
    healthScore,
    dimensions,
    evidence,
    evidenceCatalog: input.evidenceCatalog,
    findings,
    insights,
    risks,
    recommendations,
    timeline: input.timeline,
    dna: input.dna,
    reports: input.reports,
    scoreChange,
    executiveBrief: input.executiveBrief,
  };
}
