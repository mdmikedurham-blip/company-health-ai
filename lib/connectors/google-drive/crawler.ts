import type { RawConnectorItem } from "../connector";
import { GOOGLE_DRIVE_FILES_URL } from "./constants";

/**
 * Google Drive crawl / list helpers (read-only files.list).
 */

export interface GoogleDriveCrawlOptions {
  folderIds?: string[];
  mimeTypes?: string[];
  pageSize?: number;
  /** Max files to return across pages (safety cap). */
  maxFiles?: number;
}

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  description?: string;
  owners?: Array<{ emailAddress?: string; displayName?: string }>;
};

type DriveListResponse = {
  files?: DriveFile[];
  nextPageToken?: string;
};

function buildQuery(options: GoogleDriveCrawlOptions): string {
  const parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"];
  if (options.folderIds?.length) {
    const folderClause = options.folderIds
      .map((id) => `'${id}' in parents`)
      .join(" or ");
    parts.push(`(${folderClause})`);
  }
  if (options.mimeTypes?.length) {
    const mimeClause = options.mimeTypes
      .map((m) => `mimeType = '${m}'`)
      .join(" or ");
    parts.push(`(${mimeClause})`);
  }
  return parts.join(" and ");
}

function toRawItem(file: DriveFile, syncedAt: string): RawConnectorItem {
  const owner =
    file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || "";
  const summaryParts = [
    file.description?.trim(),
    file.mimeType ? `Type: ${file.mimeType}` : null,
    owner ? `Owner: ${owner}` : null,
    file.modifiedTime ? `Modified: ${file.modifiedTime}` : null,
  ].filter(Boolean);

  return {
    externalId: file.id,
    title: file.name,
    syncedAt,
    rawSummary: summaryParts.join(" · ") || `Google Drive file: ${file.name}`,
    mimeType: file.mimeType,
    metadata: {
      uri: file.webViewLink ?? "",
      sourceSystem: "Google Drive",
      sourceType: "document",
      occurredAt: file.modifiedTime ?? syncedAt,
      // Production normalize for Drive files uses lightweight metadata until LLM extraction.
      evidenceId: `gdrive-${file.id}`,
      reliability: "70",
      dimensionIds: JSON.stringify(["dim-governance"]),
      extractedFacts: JSON.stringify({}),
    },
  };
}

/** Page Drive files into RawConnectorItem[] using a read-only access token. */
export async function crawlGoogleDrive(
  accessToken: string,
  options: GoogleDriveCrawlOptions = {},
): Promise<RawConnectorItem[]> {
  const pageSize = Math.min(options.pageSize ?? 100, 100);
  const maxFiles = options.maxFiles ?? 500;
  const syncedAt = new Date().toISOString();
  const items: RawConnectorItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, description, owners)",
      q: buildQuery(options),
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "user",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Drive files.list failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as DriveListResponse;
    for (const file of data.files ?? []) {
      items.push(toRawItem(file, syncedAt));
      if (items.length >= maxFiles) {
        return items;
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}
