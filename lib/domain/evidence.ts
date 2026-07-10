import type { DimensionId, EvidenceId, FindingId, RiskId } from "./primitives";

export interface Evidence {
  id: EvidenceId;
  sourceSystem: string;
  documentName: string;
  confidence: number;
  dimensionId: DimensionId;
  dimension: string;
  lastReviewed: string;
  summary: string;
  findingIds: FindingId[];
  linkedRiskIds: RiskId[];
}

export interface ConnectorSummary {
  id: string;
  name: string;
  system: string;
  documentsAnalyzed: number;
  lastSynced: string;
}

export interface EvidenceCatalog {
  totalDocuments: number;
  systemsConnected: number;
  lastFullScan: string;
  connectors: ConnectorSummary[];
}

export function formatEvidenceLabel(
  evidence: Pick<Evidence, "sourceSystem" | "documentName">,
): string {
  return `${evidence.sourceSystem} · ${evidence.documentName}`;
}
