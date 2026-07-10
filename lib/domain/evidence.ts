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
 *
 * Pipeline: Evidence → Insight → Finding → Risk → HealthScore → Recommendation
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
  /** @deprecated Prefer `title` — kept for UI adapters. */
  documentName: string;
  /** @deprecated Prefer `reliability` — kept for UI adapters. */
  confidence: number;
  /** @deprecated Prefer `collectedAt` — kept for UI adapters. */
  lastReviewed: string;
  /** @deprecated Prefer `contentSummary` — kept for UI adapters. */
  summary: string;
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
  evidence: Pick<Evidence, "sourceSystem" | "title" | "documentName">,
): string {
  const title = evidence.title || evidence.documentName;
  return `${evidence.sourceSystem} · ${title}`;
}
