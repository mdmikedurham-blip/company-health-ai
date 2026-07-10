/**
 * Incremental sync — detect which Drive documents actually changed.
 * Prefer content_hash; fall back to modified_at for Google Workspace files.
 */
import type { RawConnectorItem } from "../connector";

export type StoredDocumentRef = {
  id: string;
  externalId: string;
  contentHash: string | null;
  modifiedAt: string | null;
};

export type DocumentDelta = {
  added: RawConnectorItem[];
  changed: RawConnectorItem[];
  unchanged: RawConnectorItem[];
  deletedExternalIds: string[];
};

export function isDocumentChanged(
  stored: Pick<StoredDocumentRef, "contentHash" | "modifiedAt">,
  incoming: Pick<RawConnectorItem, "contentHash" | "modifiedAt">,
): boolean {
  if (incoming.contentHash && stored.contentHash) {
    return incoming.contentHash !== stored.contentHash;
  }
  if (incoming.modifiedAt && stored.modifiedAt) {
    return incoming.modifiedAt !== stored.modifiedAt;
  }
  // Conservative: re-extract when we cannot prove equality.
  return true;
}

/**
 * Diff crawled inventory against stored document refs.
 */
export function diffDocuments(
  stored: StoredDocumentRef[],
  incoming: RawConnectorItem[],
): DocumentDelta {
  const byExternalId = new Map(stored.map((d) => [d.externalId, d]));
  const seen = new Set<string>();

  const added: RawConnectorItem[] = [];
  const changed: RawConnectorItem[] = [];
  const unchanged: RawConnectorItem[] = [];

  for (const item of incoming) {
    seen.add(item.externalId);
    const prev = byExternalId.get(item.externalId);
    if (!prev) {
      added.push(item);
      continue;
    }
    if (isDocumentChanged(prev, item)) {
      changed.push(item);
    } else {
      unchanged.push(item);
    }
  }

  const deletedExternalIds = stored
    .filter((d) => !seen.has(d.externalId))
    .map((d) => d.externalId);

  return { added, changed, unchanged, deletedExternalIds };
}

export function evidenceIdForDriveFile(externalId: string): string {
  return `gdrive-${externalId}`;
}

export function deltaHasWork(delta: DocumentDelta): boolean {
  return (
    delta.added.length > 0 ||
    delta.changed.length > 0 ||
    delta.deletedExternalIds.length > 0
  );
}
