/**
 * Canonical document / evidence-candidate contracts.
 *
 * Every connector translates external payloads into these shapes before
 * intelligence runs. Adding HubSpot, Carta, Box, QuickBooks, Slack,
 * Salesforce, or Dropbox means implementing a translator — not changing
 * the scoring engine.
 *
 * Pipeline:
 *   Connector sync → RawDocument
 *                 → ExtractedDocument (text/sections)
 *                 → EvidenceCandidate
 *                 → Evidence (domain)
 */

import type { ConnectorId } from "../connector";
import type { DocumentSection } from "../extraction/types";
import type { EvidenceExtractionResult } from "../evidence-extraction/types";

/**
 * Connector-agnostic inventory document — file metadata before content extract.
 * Maps 1:1 with the `documents` table / RawConnectorItem inventory fields.
 */
export interface RawDocument {
  /** Stable id within the source system (Drive file id, HubSpot object id, …). */
  externalId: string;
  connectorId: ConnectorId;
  sourceSystem: string;
  title: string;
  /** Logical path / folder hierarchy within the source. */
  path?: string;
  /** Last modified in the source system (ISO-8601). */
  modifiedAt?: string;
  owner?: string;
  mimeType?: string;
  /** Content fingerprint for incremental sync (md5/sha1/…). */
  contentHash?: string;
  uri?: string;
  /** Short inventory summary before full text extraction. */
  rawSummary: string;
  /** When this inventory row was synced (ISO-8601). */
  syncedAt: string;
  /** Opaque connector-specific fields (never a pre-built Evidence object). */
  metadata: Record<string, string | number | boolean | null>;
}

/**
 * Intermediate evidence proposal produced by the extraction pipeline.
 * Not yet domain Evidence — no finding/risk reverse links.
 */
export interface EvidenceCandidate {
  /** Proposed evidence id (stable across syncs when possible). */
  proposedId: string;
  sourceSystem: string;
  sourceType: string;
  title: string;
  contentSummary: string;
  dimensionId: string;
  dimension: string;
  occurredAt: string;
  collectedAt: string;
  /** 0–100 confidence / reliability. */
  confidence: number;
  /** Structured facts for rules (same keys as Evidence.extractedFacts). */
  facts: Record<string, string | number | boolean | string[] | null>;
  /** Provenance back to the source document. */
  rawDocument: Pick<
    RawDocument,
    | "externalId"
    | "connectorId"
    | "path"
    | "uri"
    | "contentHash"
    | "mimeType"
    | "owner"
  >;
  /** Full extraction JSON for audit / reprocessing. */
  extraction: EvidenceExtractionResult;
  /** Optional section anchors from ExtractedDocument. */
  sections?: DocumentSection[];
  metadata: Record<string, string | number | boolean | null>;
  citation: {
    label: string;
    uri?: string;
    locator?: string;
  };
}
