/**
 * Canonical health dimension vocabulary.
 * Shared by connectors (labeling evidence) and the intelligence layer.
 * Lives in domain so connectors never import intelligence.
 */

export const DIMENSION_IDS = [
  "dim-financial",
  "dim-revenue-quality",
  "dim-customer",
  "dim-legal",
  "dim-governance",
  "dim-security",
  "dim-people",
  "dim-operations",
  "dim-product",
  "dim-ai-readiness",
] as const;

export type KnownDimensionId = (typeof DIMENSION_IDS)[number];

export const DIMENSION_NAMES: Record<string, string> = {
  "dim-financial": "Financial",
  "dim-revenue-quality": "Revenue Quality",
  "dim-customer": "Customer",
  "dim-legal": "Legal",
  "dim-governance": "Governance",
  "dim-people": "People",
  "dim-security": "Security",
  "dim-operations": "Operations",
  "dim-product": "Product",
  "dim-ai-readiness": "AI Readiness",
};

export function dimensionName(dimensionId: string): string {
  return DIMENSION_NAMES[dimensionId] ?? dimensionId;
}
