/**
 * Shared Evidence factory for connector adapters.
 * Produces the canonical Evidence shape (no deprecated UI alias fields).
 */

import type { Evidence, ExtractedFacts } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";

export interface EvidenceInput {
  id: string;
  sourceSystem: string;
  sourceType: string;
  title: string;
  contentSummary: string;
  extractedFacts: ExtractedFacts;
  dimensionIds: string[];
  occurredAt: string;
  collectedAt: string;
  reliability: number;
  metadata?: Evidence["metadata"];
  citation?: Partial<Evidence["citation"]>;
}

export function createEvidence(params: EvidenceInput): Evidence {
  const dimensionId = params.dimensionIds[0]!;
  return {
    id: params.id,
    sourceSystem: params.sourceSystem,
    sourceType: params.sourceType,
    title: params.title,
    contentSummary: params.contentSummary,
    extractedFacts: params.extractedFacts,
    dimensionIds: params.dimensionIds,
    dimensionId,
    dimension: dimensionName(dimensionId),
    occurredAt: params.occurredAt,
    collectedAt: params.collectedAt,
    reliability: params.reliability,
    metadata: params.metadata ?? {},
    citation: {
      label: `${params.sourceSystem} · ${params.title}`,
      ...params.citation,
    },
    findingIds: [],
    linkedRiskIds: [],
  };
}
