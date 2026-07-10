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

/** Default company for OAuth until Supabase Auth is wired. */
export function getDefaultCompanyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? "company-acme";
}
