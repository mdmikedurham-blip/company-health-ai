import {
  createDefaultConnectorRegistry,
  type ConnectorRegistry,
} from "@/lib/connectors";
import type { CompanyDNA } from "@/lib/domain";
import { runInsightEngine } from "@/lib/insight-engine";

export interface LoadCompanyDNAOptions {
  companyId?: string;
  companyName?: string;
  industry?: string;
  stage?: string;
  registry?: ConnectorRegistry;
}

/**
 * Orchestrates connectors → Insight Engine → CompanyDNA.
 * UI layers call this (or an API that wraps it) and never talk to connectors.
 */
export async function loadCompanyDNA(
  options: LoadCompanyDNAOptions = {},
): Promise<CompanyDNA> {
  const {
    companyId = "acme-corp",
    companyName = "Acme Corp",
    industry = "B2B SaaS",
    stage = "Series A",
    registry = createDefaultConnectorRegistry(),
  } = options;

  const evidence = await registry.collectAll({ companyId });
  const { dna } = runInsightEngine({
    companyId,
    companyName,
    industry,
    stage,
    evidence,
  });

  return dna;
}
