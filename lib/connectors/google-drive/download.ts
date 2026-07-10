/**
 * Download / export Google Drive files into text or bytes for extraction.
 * Native Google types are exported; binary/office/text files are downloaded.
 */
import {
  GOOGLE_DRIVE_FILES_URL,
  type GoogleDriveSupportedMimeType,
} from "./constants";

/** Drive export MIME for Google Workspace files. */
export const GOOGLE_DRIVE_EXPORT_MIME: Partial<
  Record<GoogleDriveSupportedMimeType, string>
> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export type DriveFileContent = {
  mimeType: string;
  /** Decoded text when export/download is textual. */
  text?: string;
  /** Raw bytes for binary formats (PDF, DOCX). */
  bytes?: Uint8Array;
};

function fileMediaUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`;
}

function fileExportUrl(fileId: string, exportMime: string): string {
  const params = new URLSearchParams({ mimeType: exportMime });
  return `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}/export?${params}`;
}

export async function downloadDriveFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string,
): Promise<DriveFileContent> {
  const exportMime =
    GOOGLE_DRIVE_EXPORT_MIME[mimeType as GoogleDriveSupportedMimeType];
  const url = exportMime
    ? fileExportUrl(fileId, exportMime)
    : fileMediaUrl(fileId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Google Drive download/export failed for ${fileId}: ${res.status} ${body}`,
    );
  }

  const isText =
    Boolean(exportMime) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json";

  if (isText) {
    return { mimeType, text: await res.text() };
  }

  const buffer = await res.arrayBuffer();
  return { mimeType, bytes: new Uint8Array(buffer) };
}
