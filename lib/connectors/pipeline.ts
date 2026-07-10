/**
 * Full platform pipeline: Connectors → Insight Engine → CompanyHealthSnapshot.
 * Phase 2 primary path uses lib/data mock evidence; connectors remain for Phase 3.
 */
import type { CompanyHealthSnapshot, HealthDimension, HealthScore } from "@/lib/domain";
import { runInsightEngine } from "@/lib/intelligence";
import { runConnectorPipeline } from "./ingest";
import type { HealthConnector } from "./types";

export interface PlatformInput {
  connectors: HealthConnector[];
  lastFullScan: string;
  company: CompanyHealthSnapshot["company"];
  dimensions: HealthDimension[];
  previousHealthScore?: HealthScore;
  dna: CompanyHealthSnapshot["dna"];
  reports: CompanyHealthSnapshot["reports"];
  timeline?: CompanyHealthSnapshot["timeline"];
  executiveBrief: CompanyHealthSnapshot["executiveBrief"];
}

export function buildCompanyHealthSnapshot(input: PlatformInput): CompanyHealthSnapshot {
  const { evidence, evidenceCatalog } = runConnectorPipeline({
    connectors: input.connectors,
    lastFullScan: input.lastFullScan,
  });

  const engine = runInsightEngine({
    companyId: input.company.id,
    evidence,
    previousHealthScore: input.previousHealthScore,
    dimensionProfiles: input.dimensions,
  });

  return {
    company: input.company,
    healthScore: engine.healthScore,
    dimensions: engine.dimensions,
    evidence: engine.evidence,
    evidenceCatalog,
    findings: engine.findings,
    insights: engine.insights,
    risks: engine.risks,
    recommendations: engine.recommendations,
    timeline: [...engine.timelineEvents, ...(input.timeline ?? [])],
    dna: input.dna,
    reports: input.reports,
    scoreChange: engine.scoreChange,
    executiveBrief: input.executiveBrief,
  };
}
