import type {
  DimensionId,
  EvidenceId,
  FindingId,
  RiskId,
} from "./primitives";

/**
 * Structured fact extracted from a source document.
 * Rules engines read these keys; an LLM can populate them later without UI changes.
 */
export type ExtractedFacts = Record<string, string | number | boolean | string[] | null>;

export interface EvidenceCitation {
  label: string;
  uri?: string;
  locator?: string;
}

/**
 * Normalized evidence record — input to the Insight Engine.
 * UI list views project this via EvidenceRecordView (lib/types) — no dual fields here.
 */
export interface Evidence {
  id: EvidenceId;
  sourceSystem: string;
  sourceType: string;
  title: string;
  contentSummary: string;
  extractedFacts: ExtractedFacts;
  dimensionIds: DimensionId[];
  /** Primary dimension for UI projections that expect a single dimension. */
  dimensionId: DimensionId;
  dimension: string;
  occurredAt: string;
  collectedAt: string;
  reliability: number;
  metadata: Record<string, string | number | boolean | null>;
  citation: EvidenceCitation;
  /** Engine-populated reverse links */
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
  evidence: Pick<Evidence, "sourceSystem" | "title">,
): string {
  return `${evidence.sourceSystem} · ${evidence.title}`;
}
