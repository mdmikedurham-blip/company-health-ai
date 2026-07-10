/**
 * Evidence Extraction pipeline — production path (no mock dashboard data).
 *
 *   ExtractedDocument (+ RawDocument provenance)
 *         ↓  extractEvidence()
 *   EvidenceExtractionResult
 *         ↓  toEvidenceCandidate()
 *   EvidenceCandidate
 *         ↓  evidenceFromCandidate()
 *   Evidence (domain)
 */

import type { Evidence, ExtractedFacts } from "@/lib/domain";
import { dimensionIdFromName, dimensionName } from "@/lib/domain/dimensions";
import { createEvidence } from "../create-evidence";
import type { ExtractedDocument } from "../extraction/types";
import { extractEvidence } from "../evidence-extraction/extract-evidence";
import type { EvidenceExtractionResult } from "../evidence-extraction/types";
import type { EvidenceCandidate, RawDocument } from "./types";

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

function resolveDimensionId(extraction: EvidenceExtractionResult): string {
  return (
    dimensionIdFromName(extraction.dimension) ??
    EVIDENCE_TYPE_TO_DIMENSION[extraction.evidenceType] ??
    "dim-governance"
  );
}

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
    facts.mfaCoverage = Number(mfa[1]) / 100;
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
    facts.top3CustomerArrShare = Number(concentration[1]) / 100;
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

function defaultEvidenceId(raw: RawDocument): string {
  const prefix =
    typeof raw.connectorId === "string"
      ? raw.connectorId.replace(/[^a-z0-9]+/gi, "-")
      : "doc";
  return `${prefix}-${raw.externalId}`;
}

/**
 * Build an EvidenceCandidate from extraction JSON + inventory provenance.
 */
export function toEvidenceCandidate(
  raw: RawDocument,
  extracted: ExtractedDocument,
  extraction: EvidenceExtractionResult,
  options?: { evidenceId?: string },
): EvidenceCandidate {
  const dimensionId = resolveDimensionId(extraction);
  const text = extracted.text || raw.rawSummary || raw.title;
  const firstIso = extraction.dates.find((d) => d.iso)?.iso;
  const proposedId = options?.evidenceId ?? defaultEvidenceId(raw);

  return {
    proposedId,
    sourceSystem: raw.sourceSystem,
    sourceType: extraction.evidenceType,
    title: raw.title || extracted.title,
    contentSummary:
      extraction.sourceQuotes[0]?.text ||
      raw.rawSummary ||
      extracted.text.slice(0, 500) ||
      `Evidence from ${raw.title}`,
    dimensionId,
    dimension: dimensionName(dimensionId),
    occurredAt: firstIso ?? raw.modifiedAt ?? raw.syncedAt,
    collectedAt: raw.syncedAt,
    confidence: extraction.confidence,
    facts: inferTypedFacts(extraction, text),
    rawDocument: {
      externalId: raw.externalId,
      connectorId: raw.connectorId,
      path: raw.path,
      uri: raw.uri,
      contentHash: raw.contentHash,
      mimeType: raw.mimeType,
      owner: raw.owner,
    },
    extraction,
    sections: extracted.sections,
    metadata: {
      fileId: raw.externalId,
      path: raw.path ?? null,
      owner: raw.owner ?? null,
      contentHash: raw.contentHash ?? null,
      format: extracted.metadata.format ?? null,
      evidenceType: extraction.evidenceType,
      extractionConfidence: extraction.confidence,
      connectorId: raw.connectorId,
    },
    citation: {
      label: `${raw.sourceSystem} · ${raw.title || extracted.title}`,
      uri: raw.uri,
      locator: raw.path,
    },
  };
}

/** Promote EvidenceCandidate → domain Evidence for the Insight Engine. */
export function evidenceFromCandidate(candidate: EvidenceCandidate): Evidence {
  return createEvidence({
    id: candidate.proposedId,
    sourceSystem: candidate.sourceSystem,
    sourceType: candidate.sourceType,
    title: candidate.title,
    contentSummary: candidate.contentSummary,
    extractedFacts: candidate.facts,
    dimensionIds: [candidate.dimensionId],
    occurredAt: candidate.occurredAt,
    collectedAt: candidate.collectedAt,
    reliability: candidate.confidence,
    metadata: candidate.metadata,
    citation: candidate.citation,
  });
}

export interface ExtractEvidencePipelineOptions {
  /** Override proposed evidence id (e.g. stable Drive id). */
  evidenceId?: string;
}

/**
 * Full pipeline: ExtractedDocument → EvidenceCandidate → Evidence.
 * Does not read mock dashboard data — only the provided document + provenance.
 */
export function runEvidenceExtractionPipeline(
  raw: RawDocument,
  extracted: ExtractedDocument,
  options?: ExtractEvidencePipelineOptions,
): { candidate: EvidenceCandidate; evidence: Evidence } {
  const extraction = extractEvidence(extracted);
  const candidate = toEvidenceCandidate(raw, extracted, extraction, options);
  return {
    candidate,
    evidence: evidenceFromCandidate(candidate),
  };
}

/**
 * Batch pipeline for connector sync deltas.
 */
export function runEvidenceExtractionPipelineBatch(
  pairs: Array<{
    raw: RawDocument;
    extracted: ExtractedDocument;
    evidenceId?: string;
  }>,
): { candidates: EvidenceCandidate[]; evidence: Evidence[] } {
  const candidates: EvidenceCandidate[] = [];
  const evidence: Evidence[] = [];
  for (const pair of pairs) {
    const result = runEvidenceExtractionPipeline(pair.raw, pair.extracted, {
      evidenceId: pair.evidenceId,
    });
    candidates.push(result.candidate);
    evidence.push(result.evidence);
  }
  return { candidates, evidence };
}
