/**
 * Bridge EvidenceExtractionResult JSON → domain Evidence.
 * Evidence Store step: extraction output becomes Insight Engine input.
 */
import type { Evidence, ExtractedFacts } from "@/lib/domain";
import { dimensionIdFromName } from "@/lib/domain/dimensions";
import { createEvidence } from "../create-evidence";
import type { RawConnectorItem } from "../connector";
import type { EvidenceExtractionResult } from "./types";

const EVIDENCE_TYPE_TO_DIMENSION: Record<string, string> = {
  financial: "dim-financial",
  revenue: "dim-revenue-quality",
  customer: "dim-customer",
  legal: "dim-legal",
  governance: "dim-governance",
  security: "dim-security",
  people: "dim-people",
  operations: "dim-operations",
  product: "dim-product",
  general: "dim-governance",
};

function inferTypedFacts(
  extraction: EvidenceExtractionResult,
  text: string,
): ExtractedFacts {
  const facts: ExtractedFacts = {
    extractionFacts: extraction.facts,
    recommendedFindingTitle: extraction.recommendedFinding.title,
    recommendedFindingDirection: extraction.recommendedFinding.direction,
    recommendedFindingMateriality: extraction.recommendedFinding.materiality,
    evidenceType: extraction.evidenceType,
  };

  const runway =
    /\b(?:cash\s+)?runway\s*(?:of\s*|is\s*|:?\s*)(\d+(?:\.\d+)?)\s*months?\b/i.exec(
      text,
    ) ??
    /\b(\d+(?:\.\d+)?)\s*months?\s+(?:of\s+)?(?:cash\s+)?runway\b/i.exec(text);
  if (runway?.[1]) {
    facts.cashRunwayMonths = Number(runway[1]);
  }

  const mfa =
    /\bmfa\s+coverage\s*(?:is\s*|:?\s*)(\d+(?:\.\d+)?)\s*%/i.exec(text) ??
    /\b(\d+(?:\.\d+)?)\s*%\s*mfa\b/i.exec(text);
  if (mfa?.[1]) {
    facts.mfaCoverage = Number(mfa[1]);
  }

  const critical =
    /\b(\d+)\s+open\s+critical\s+controls?\b/i.exec(text) ??
    /\bopen\s+critical\s+controls?\s*:?\s*(\d+)\b/i.exec(text);
  if (critical?.[1]) {
    facts.openCriticalControls = Number(critical[1]);
  }

  const ipGap =
    /\b(?:missing\s+ip\s+assignment[^.]*?(\d+)\s+contractor|\b(\d+)\s+contractor[^.]*missing\s+ip)\b/i.exec(
      text,
    );
  if (ipGap) {
    const n = Number(ipGap[1] ?? ipGap[2]);
    if (Number.isFinite(n)) facts.agreementsMissingIpAssignment = n;
  }

  const concentration =
    /\btop\s*3\s+customer[^.]*?(\d+(?:\.\d+)?)\s*%/i.exec(text) ??
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:arr|revenue).{0,40}top\s*3\b/i.exec(
      text,
    );
  if (concentration?.[1]) {
    facts.top3CustomerArrShare = Number(concentration[1]);
  }

  if (extraction.dates.length > 0) {
    facts.extractionDateCount = extraction.dates.length;
  }
  if (extraction.amounts.length > 0) {
    facts.extractionAmountCount = extraction.amounts.length;
  }
  if (extraction.people.length > 0) {
    facts.extractionPeople = extraction.people.map((p) =>
      p.role ? `${p.name} (${p.role})` : p.name,
    );
  }

  return facts;
}

function resolveDimensionId(extraction: EvidenceExtractionResult): string {
  return (
    dimensionIdFromName(extraction.dimension) ??
    EVIDENCE_TYPE_TO_DIMENSION[extraction.evidenceType] ??
    "dim-governance"
  );
}

/**
 * Convert extraction JSON + inventory item into domain Evidence for the store.
 */
export function evidenceFromExtraction(
  item: RawConnectorItem,
  extraction: EvidenceExtractionResult,
): Evidence {
  const dimensionId = resolveDimensionId(extraction);
  const text = item.rawSummary || item.title;
  const evidenceId =
    item.metadata?.evidenceId ||
    `gdrive-${item.externalId}`;

  const firstIso = extraction.dates.find((d) => d.iso)?.iso;

  return createEvidence({
    id: evidenceId,
    sourceSystem: item.metadata?.sourceSystem ?? "Google Drive",
    sourceType: extraction.evidenceType,
    title: item.title,
    contentSummary:
      extraction.sourceQuotes[0]?.text ||
      item.rawSummary ||
      `Evidence from ${item.title}`,
    extractedFacts: inferTypedFacts(extraction, text),
    dimensionIds: [dimensionId],
    occurredAt: firstIso ?? item.modifiedAt ?? item.syncedAt,
    collectedAt: item.syncedAt,
    reliability: extraction.confidence,
    metadata: {
      fileId: item.externalId,
      path: item.path ?? null,
      owner: item.owner ?? null,
      contentHash: item.contentHash ?? null,
      format: item.metadata?.format ?? null,
      evidenceType: extraction.evidenceType,
      extractionConfidence: extraction.confidence,
    },
    citation: {
      label: `Google Drive · ${item.title}`,
      uri: item.metadata?.uri || undefined,
      locator: item.path || undefined,
    },
  });
}

/** Parse evidenceJson from raw item metadata when present. */
export function evidenceFromRawExtractionItem(
  item: RawConnectorItem,
): Evidence | null {
  const json = item.metadata?.evidenceJson;
  if (!json) return null;
  try {
    const extraction = JSON.parse(json) as EvidenceExtractionResult;
    return evidenceFromExtraction(item, extraction);
  } catch {
    return null;
  }
}
