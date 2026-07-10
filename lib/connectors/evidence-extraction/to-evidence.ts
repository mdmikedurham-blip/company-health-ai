/**
 * Bridge EvidenceExtractionResult JSON → domain Evidence.
 * Evidence Store step: extraction output becomes Insight Engine input.
 *
 * Prefer `runEvidenceExtractionPipeline` / `evidenceFromCandidate` for new
 * connector code. These helpers remain for RawConnectorItem-based adapters.
 */
import type { Evidence } from "@/lib/domain";
import type { RawConnectorItem } from "../connector";
import {
  evidenceFromCandidate,
  rawDocumentFromConnectorItem,
  toEvidenceCandidate,
} from "../documents";
import type { ExtractedDocument } from "../extraction/types";
import type { EvidenceExtractionResult } from "./types";

/**
 * Convert extraction JSON + inventory item into domain Evidence for the store.
 */
export function evidenceFromExtraction(
  item: RawConnectorItem,
  extraction: EvidenceExtractionResult,
): Evidence {
  const sourceSystem = item.metadata?.sourceSystem ?? "Google Drive";
  const connectorId = item.metadata?.connectorId ?? "google-drive";
  const raw = rawDocumentFromConnectorItem(item, connectorId, sourceSystem);

  const extracted: ExtractedDocument = {
    text: item.rawSummary || item.title,
    title: item.title,
    metadata: {
      fileId: item.externalId,
      format: item.metadata?.format ?? null,
    },
    sections: [],
  };

  const candidate = toEvidenceCandidate(raw, extracted, extraction, {
    evidenceId: item.metadata?.evidenceId,
  });
  return evidenceFromCandidate(candidate);
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
