import type { RawConnectorItem } from "../connector";
import {
  GOOGLE_DRIVE_FILES_URL,
  GOOGLE_DRIVE_SUPPORTED_MIME_TYPES,
} from "./constants";

/**
 * Google Drive crawl / list helpers (read-only files.list).
 *
 * Captures inventory metadata: file id, path, modified, owner, mime type, hash.
 * Defaults to supported formats: PDF, DOCX, Docs, Sheets, Slides, TXT, Markdown, CSV.
 */

export interface GoogleDriveCrawlOptions {
  folderIds?: string[];
  /**
   * MIME types to include. Defaults to GOOGLE_DRIVE_SUPPORTED_MIME_TYPES.
   * Pass an empty array to list all non-folder files (not recommended).
   */
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
  md5Checksum?: string;
  sha1Checksum?: string;
  parents?: string[];
  owners?: Array<{ emailAddress?: string; displayName?: string }>;
};

type DriveListResponse = {
  files?: DriveFile[];
  nextPageToken?: string;
};

const DRIVE_FILE_FIELDS =
  "id, name, mimeType, modifiedTime, webViewLink, description, owners, md5Checksum, sha1Checksum, parents";

function resolveMimeTypes(options: GoogleDriveCrawlOptions): string[] | null {
  if (options.mimeTypes === undefined) {
    return [...GOOGLE_DRIVE_SUPPORTED_MIME_TYPES];
  }
  if (options.mimeTypes.length === 0) {
    return null;
  }
  return options.mimeTypes;
}

function buildQuery(options: GoogleDriveCrawlOptions): string {
  const parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"];
  if (options.folderIds?.length) {
    const folderClause = options.folderIds
      .map((id) => `'${id}' in parents`)
      .join(" or ");
    parts.push(`(${folderClause})`);
  }
  const mimeTypes = resolveMimeTypes(options);
  if (mimeTypes?.length) {
    const mimeClause = mimeTypes
      .map((m) => `mimeType = '${m}'`)
      .join(" or ");
    parts.push(`(${mimeClause})`);
  }
  return parts.join(" and ");
}

function contentHash(file: DriveFile): string | undefined {
  if (file.md5Checksum) return `md5:${file.md5Checksum}`;
  if (file.sha1Checksum) return `sha1:${file.sha1Checksum}`;
  return undefined;
}

function ownerLabel(file: DriveFile): string | undefined {
  const owner = file.owners?.[0];
  if (!owner) return undefined;
  return owner.displayName || owner.emailAddress || undefined;
}

/** Path within Drive: parent folder id prefix when known, else file name. */
function filePath(file: DriveFile): string {
  const parent = file.parents?.[0];
  return parent ? `${parent}/${file.name}` : file.name;
}

function toRawItem(file: DriveFile, syncedAt: string): RawConnectorItem {
  const owner = ownerLabel(file);
  const hash = contentHash(file);
  const path = filePath(file);
  const summaryParts = [
    file.description?.trim(),
    file.mimeType ? `Type: ${file.mimeType}` : null,
    owner ? `Owner: ${owner}` : null,
    file.modifiedTime ? `Modified: ${file.modifiedTime}` : null,
    hash ? `Hash: ${hash}` : null,
  ].filter(Boolean);

  return {
    externalId: file.id,
    title: file.name,
    path,
    modifiedAt: file.modifiedTime,
    owner,
    mimeType: file.mimeType,
    contentHash: hash,
    syncedAt,
    rawSummary: summaryParts.join(" · ") || `Google Drive file: ${file.name}`,
    metadata: {
      uri: file.webViewLink ?? "",
      sourceSystem: "Google Drive",
      sourceType: "document",
      occurredAt: file.modifiedTime ?? syncedAt,
      parentId: file.parents?.[0] ?? "",
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
      fields: `nextPageToken, files(${DRIVE_FILE_FIELDS})`,
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
