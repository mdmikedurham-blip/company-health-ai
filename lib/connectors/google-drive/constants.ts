/** Read-only Drive scope — list + download/export, no write. */
export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export const GOOGLE_OAUTH_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v2/userinfo";
export const GOOGLE_DRIVE_FILES_URL =
  "https://www.googleapis.com/drive/v3/files";

export const GOOGLE_DRIVE_CONNECTOR_ID = "google-drive" as const;

/**
 * Supported Drive file types for inventory + extraction.
 * PDF, DOCX, Google Docs/Sheets/Slides, TXT, Markdown, CSV.
 */
export const GOOGLE_DRIVE_SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;

export type GoogleDriveSupportedMimeType =
  (typeof GOOGLE_DRIVE_SUPPORTED_MIME_TYPES)[number];

export const GOOGLE_DRIVE_SUPPORTED_FORMATS = [
  "PDF",
  "DOCX",
  "Google Docs",
  "Google Sheets",
  "Google Slides",
  "TXT",
  "Markdown",
  "CSV",
] as const;

/** Default company for OAuth until Supabase Auth is wired. */
export function getDefaultCompanyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? "company-acme";
}
