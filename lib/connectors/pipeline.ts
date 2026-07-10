import type { CompanyHealthSnapshot } from "@/lib/domain";
import { runInsightEngine, type InsightEngineInput } from "@/lib/engine";
import { runConnectorPipeline } from "./ingest";
import type { HealthConnector } from "./types";

/**
 * Full platform pipeline: Connectors → Insight Engine → CompanyHealthSnapshot.
 *
 * This is the single integration point for production. Adding a connector
 * requires only registering a new HealthConnector adapter — no UI changes.
 */
export type PlatformInput = Omit<InsightEngineInput, "evidence" | "evidenceCatalog"> & {
  connectors: HealthConnector[];
  lastFullScan: string;
};

export function buildCompanyHealthSnapshot(input: PlatformInput): CompanyHealthSnapshot {
  const { connectors, lastFullScan, ...engineInput } = input;
  const { evidence, evidenceCatalog } = runConnectorPipeline({ connectors, lastFullScan });

  return runInsightEngine({
    ...engineInput,
    evidence,
    evidenceCatalog,
  });
}
