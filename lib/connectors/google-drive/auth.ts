/**
 * Google Drive OAuth / credential helpers.
 * Mock path does not authenticate; real sync will use these stubs.
 */

export interface GoogleDriveAuthConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface GoogleDriveCredentials {
  accessToken: string;
  expiresAt: number;
}

/** Placeholder — returns null until OAuth is wired. */
export async function getGoogleDriveCredentials(
  _config: GoogleDriveAuthConfig = {},
): Promise<GoogleDriveCredentials | null> {
  return null;
}

export function isGoogleDriveAuthenticated(
  credentials: GoogleDriveCredentials | null,
): boolean {
  return credentials !== null && credentials.expiresAt > Date.now();
}
