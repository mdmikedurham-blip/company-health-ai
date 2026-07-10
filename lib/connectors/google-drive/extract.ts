import type { ExtractedDocument } from "../extraction";
import { extractDocument } from "../extraction";
import type { EvidenceExtractionResult } from "../evidence-extraction";
import { extractEvidence } from "../evidence-extraction";
import type { RawConnectorItem } from "../connector";
import { downloadDriveFileContent } from "./download";

export type DriveExtractionBundle = {
  document: ExtractedDocument;
  evidence: EvidenceExtractionResult;
};

/**
 * Download/export a Drive file and produce an ExtractedDocument.
 */
export async function extractDriveDocument(
  accessToken: string,
  item: Pick<
    RawConnectorItem,
    | "externalId"
    | "title"
    | "mimeType"
    | "path"
    | "owner"
    | "modifiedAt"
    | "contentHash"
    | "metadata"
  >,
): Promise<ExtractedDocument> {
  const mimeType = item.mimeType;
  if (!mimeType) {
    throw new Error(`Drive file ${item.externalId} missing mimeType`);
  }

  const content = await downloadDriveFileContent(
    accessToken,
    item.externalId,
    mimeType,
  );

  return extractDocument({
    title: item.title,
    mimeType,
    text: content.text,
    bytes: content.bytes,
    sourceMetadata: {
      fileId: item.externalId,
      path: item.path ?? null,
      owner: item.owner ?? null,
      modifiedAt: item.modifiedAt ?? null,
      contentHash: item.contentHash ?? null,
      uri: item.metadata?.uri ?? null,
      sourceSystem: "Google Drive",
    },
  });
}

/**
 * Download/export + evidence extraction JSON for a single Drive file.
 */
export async function extractDriveEvidence(
  accessToken: string,
  item: Parameters<typeof extractDriveDocument>[1],
): Promise<DriveExtractionBundle> {
  const document = await extractDriveDocument(accessToken, item);
  return {
    document,
    evidence: extractEvidence(document),
  };
}

/**
 * Extract many Drive inventory items; skips failures so sync can continue.
 */
export async function extractDriveDocuments(
  accessToken: string,
  items: RawConnectorItem[],
): Promise<{
  documents: ExtractedDocument[];
  evidenceResults: EvidenceExtractionResult[];
  errors: Array<{ fileId: string; error: string }>;
}> {
  const documents: ExtractedDocument[] = [];
  const evidenceResults: EvidenceExtractionResult[] = [];
  const errors: Array<{ fileId: string; error: string }> = [];

  for (const item of items) {
    try {
      const bundle = await extractDriveEvidence(accessToken, item);
      documents.push(bundle.document);
      evidenceResults.push(bundle.evidence);
    } catch (err) {
      errors.push({
        fileId: item.externalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { documents, evidenceResults, errors };
}
