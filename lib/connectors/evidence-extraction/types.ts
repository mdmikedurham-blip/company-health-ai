/**
 * Evidence Extraction output — JSON-only contract.
 * Produced from ExtractedDocument before Insight Engine Evidence normalization.
 */

export const EVIDENCE_TYPES = [
  "financial",
  "legal",
  "governance",
  "customer",
  "security",
  "people",
  "operations",
  "product",
  "revenue",
  "general",
] as const;

export type EvidenceExtractionType = (typeof EVIDENCE_TYPES)[number];

export interface ExtractedAmount {
  raw: string;
  value: number | null;
  currency: string | null;
  context: string;
}

export interface ExtractedPerson {
  name: string;
  role: string | null;
  context: string;
}

export interface ExtractedDate {
  raw: string;
  iso: string | null;
  context: string;
}

export interface SourceQuote {
  text: string;
  sectionId: string | null;
  sectionTitle: string | null;
}

export interface RecommendedFinding {
  title: string;
  description: string;
  direction: "positive" | "negative" | "neutral";
  materiality: number;
}

/**
 * Canonical evidence extraction JSON.
 * Field names match the product contract (camelCase for JSON).
 */
export interface EvidenceExtractionResult {
  evidenceType: EvidenceExtractionType;
  dimension: string;
  confidence: number;
  facts: string[];
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
  people: ExtractedPerson[];
  sourceQuotes: SourceQuote[];
  recommendedFinding: RecommendedFinding;
}
