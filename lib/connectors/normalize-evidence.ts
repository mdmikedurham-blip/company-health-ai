/**
 * Builds domain Evidence from a raw connector item's metadata.
 * Mock collect() stores structured fields in metadata; production adapters
 * will extract the same keys from API payloads.
 */

import type { Evidence, ExtractedFacts } from "@/lib/domain";
import { createEvidence } from "./create-evidence";
import type { RawConnectorItem } from "./types";

const META = {
  evidenceId: "evidenceId",
  sourceType: "sourceType",
  reliability: "reliability",
  dimensionIds: "dimensionIds",
  extractedFacts: "extractedFacts",
  occurredAt: "occurredAt",
  sourceSystem: "sourceSystem",
} as const;

/** Serialize Evidence into raw-item metadata for collect() → normalize() round-trip. */
export function evidenceToRawMetadata(evidence: Evidence): Record<string, string> {
  return {
    [META.evidenceId]: evidence.id,
    [META.sourceType]: evidence.sourceType,
    [META.reliability]: String(evidence.reliability),
    [META.dimensionIds]: JSON.stringify(evidence.dimensionIds),
    [META.extractedFacts]: JSON.stringify(evidence.extractedFacts),
    [META.occurredAt]: evidence.occurredAt,
    [META.sourceSystem]: evidence.sourceSystem,
  };
}

/** Reconstruct Evidence from raw connector item (no hidden Evidence object). */
export function evidenceFromRawItem(item: RawConnectorItem): Evidence {
  const meta = item.metadata ?? {};
  const id = meta[META.evidenceId];
  if (!id) {
    throw new Error(`Raw item ${item.externalId} missing metadata.${META.evidenceId}`);
  }

  let dimensionIds: string[];
  let extractedFacts: ExtractedFacts;
  try {
    dimensionIds = JSON.parse(meta[META.dimensionIds] ?? "[]") as string[];
    extractedFacts = JSON.parse(meta[META.extractedFacts] ?? "{}") as ExtractedFacts;
  } catch {
    throw new Error(`Raw item ${item.externalId} has invalid dimensionIds/extractedFacts JSON`);
  }

  if (dimensionIds.length === 0) {
    throw new Error(`Raw item ${item.externalId} has empty dimensionIds`);
  }

  return createEvidence({
    id,
    sourceSystem: meta[META.sourceSystem] ?? "Unknown",
    sourceType: meta[META.sourceType] ?? "document",
    title: item.title,
    contentSummary: item.rawSummary,
    extractedFacts,
    dimensionIds,
    occurredAt: meta[META.occurredAt] ?? item.syncedAt,
    collectedAt: item.syncedAt,
    reliability: Number(meta[META.reliability] ?? 0),
  });
}
