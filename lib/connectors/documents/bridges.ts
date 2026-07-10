/**
 * Bridges between RawConnectorItem (adapter sync payload) and RawDocument
 * (canonical inventory schema). Connectors may emit either; intelligence
 * only consumes Evidence produced from EvidenceCandidate / Evidence.
 */

import type { RawConnectorItem } from "../connector";
import type { ConnectorId } from "../connector";
import type { RawDocument } from "./types";

export function rawDocumentFromConnectorItem(
  item: RawConnectorItem,
  connectorId: ConnectorId,
  sourceSystem: string,
): RawDocument {
  return {
    externalId: item.externalId,
    connectorId,
    sourceSystem:
      item.metadata?.sourceSystem ?? sourceSystem,
    title: item.title,
    path: item.path,
    modifiedAt: item.modifiedAt,
    owner: item.owner,
    mimeType: item.mimeType,
    contentHash: item.contentHash,
    uri: item.metadata?.uri,
    rawSummary: item.rawSummary,
    syncedAt: item.syncedAt,
    metadata: {
      ...(item.metadata ?? {}),
    },
  };
}

export function connectorItemFromRawDocument(
  doc: RawDocument,
): RawConnectorItem {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(doc.metadata)) {
    if (value === null || value === undefined) continue;
    metadata[key] = String(value);
  }
  if (doc.uri) metadata.uri = doc.uri;
  if (!metadata.sourceSystem) metadata.sourceSystem = doc.sourceSystem;

  return {
    externalId: doc.externalId,
    title: doc.title,
    syncedAt: doc.syncedAt,
    rawSummary: doc.rawSummary,
    path: doc.path,
    modifiedAt: doc.modifiedAt,
    owner: doc.owner,
    mimeType: doc.mimeType,
    contentHash: doc.contentHash,
    metadata,
  };
}

export function rawDocumentsFromConnectorItems(
  items: RawConnectorItem[],
  connectorId: ConnectorId,
  sourceSystem: string,
): RawDocument[] {
  return items.map((item) =>
    rawDocumentFromConnectorItem(item, connectorId, sourceSystem),
  );
}
