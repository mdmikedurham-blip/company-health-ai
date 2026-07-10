import type { Company } from "./company";
import type { CompanyDNA } from "./company-dna";
import type { Evidence, EvidenceCatalog } from "./evidence";
import type { ExecutiveBrief } from "./executive-brief";
import type { Finding } from "./finding";
import type { HealthDimension, HealthScore } from "./health";
import type { Insight } from "./insight";
import type { Recommendation } from "./recommendation";
import type { Report } from "./report";
import type { Risk } from "./risk";
import type { ScoreChangeExplanation } from "./primitives";
import type { TimelineEvent } from "./timeline";

/**
 * Root aggregate for a single company's health state at a point in time.
 *
 * All pages and services read from this snapshot. Future connectors
 * (Drive, HubSpot, Carta, etc.) populate the same entities without UI changes.
 *
 * Intelligence pipeline (Phase 2):
 *   Evidence → Findings → Insights / Risks → HealthScore changes → Recommendations
 */
export interface CompanyHealthSnapshot {
  company: Company;
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  evidence: Evidence[];
  evidenceCatalog: EvidenceCatalog;
  findings: Finding[];
  insights: Insight[];
  risks: Risk[];
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  dna: CompanyDNA;
  reports: Report[];
  scoreChange: ScoreChangeExplanation;
  executiveBrief: ExecutiveBrief;
}
