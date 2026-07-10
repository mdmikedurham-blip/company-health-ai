/**
 * Google Drive OAuth helpers — authorize URL, code exchange, refresh token storage.
 * Scope is read-only (`drive.readonly`). Refresh tokens are encrypted at rest.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import {
  createServiceClient,
  getConnectorCredential,
  isSupabaseConfigured,
  upsertConnectorCredential,
  updateConnectorCredential,
  deleteConnectorCredential,
  type AppSupabaseClient,
} from "@/lib/supabase";
import {
  GOOGLE_DRIVE_CONNECTOR_ID,
  GOOGLE_DRIVE_READONLY_SCOPE,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  getDefaultCompanyId,
} from "./constants";

export interface GoogleDriveAuthConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface GoogleDriveCredentials {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

export interface GoogleOAuthAppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function requireGoogleOAuthConfig(): GoogleOAuthAppConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function oauthStateSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    "dev-oauth-state-secret"
  );
}

export type OAuthStatePayload = {
  companyId: string;
  userId: string;
  nonce: string;
  exp: number;
};

export function createOAuthState(input: {
  companyId: string;
  userId: string;
  nonce?: string;
}): string {
  const payload: OAuthStatePayload = {
    companyId: input.companyId,
    userId: input.userId,
    nonce: input.nonce ?? randomBytes(16).toString("hex"),
    exp: Date.now() + 15 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", oauthStateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string): OAuthStatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) {
    throw new Error("Invalid OAuth state");
  }
  const expected = createHmac("sha256", oauthStateSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state signature");
  }
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as OAuthStatePayload;
  if (
    !payload.companyId ||
    !payload.userId ||
    !payload.nonce ||
    !payload.exp ||
    payload.exp < Date.now()
  ) {
    throw new Error("OAuth state expired or malformed");
  }
  return payload;
}

/** Persist nonce so the callback can enforce single-use. */
export async function storeOAuthNonce(input: {
  nonce: string;
  userId: string;
  companyId: string;
  expiresAt: number;
  client?: AppSupabaseClient;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = input.client ?? createServiceClient();
  const { error } = await client.from("oauth_state_nonces").insert({
    nonce: input.nonce,
    user_id: input.userId,
    company_id: input.companyId,
    expires_at: new Date(input.expiresAt).toISOString(),
  });
  if (error) {
    throw new Error("Failed to store OAuth state");
  }
}

/**
 * Consume a nonce exactly once. Returns false if missing, expired, or already used.
 */
export async function consumeOAuthNonce(input: {
  nonce: string;
  userId: string;
  companyId: string;
  client?: AppSupabaseClient;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Without DB, signature + expiry still apply; skip replay store.
    return true;
  }
  const client = input.client ?? createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("oauth_state_nonces")
    .update({ consumed_at: now })
    .eq("nonce", input.nonce)
    .eq("user_id", input.userId)
    .eq("company_id", input.companyId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("nonce")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to validate OAuth state");
  }
  return Boolean(data);
}

/** Build Google consent URL with offline access + read-only Drive scope. */
export async function buildGoogleDriveAuthorizeUrl(input: {
  companyId: string;
  userId: string;
  client?: AppSupabaseClient;
}): Promise<string> {
  const { clientId, redirectUri } = requireGoogleOAuthConfig();
  const nonce = randomBytes(16).toString("hex");
  const state = createOAuthState({
    companyId: input.companyId,
    userId: input.userId,
    nonce,
  });
  const payload = parseOAuthState(state);
  await storeOAuthNonce({
    nonce,
    userId: input.userId,
    companyId: input.companyId,
    expiresAt: payload.exp,
    client: input.client,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireGoogleOAuthConfig();
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireGoogleOAuthConfig();
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

/**
 * Complete OAuth: exchange code, encrypt + store refresh token, mark connected.
 */
export async function completeGoogleDriveOAuth(input: {
  code: string;
  companyId: string;
  connectedByUserId?: string | null;
  client?: AppSupabaseClient;
}): Promise<{ accountEmail: string | null }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured; cannot store refresh token");
  }
  const client = input.client ?? createServiceClient();
  const tokens = await exchangeCodeForTokens(input.code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Reconnect with prompt=consent.",
    );
  }

  const accountEmail = await fetchGoogleAccountEmail(tokens.access_token);
  const scopes = (tokens.scope ?? GOOGLE_DRIVE_READONLY_SCOPE)
    .split(/\s+/)
    .filter(Boolean);

  await upsertConnectorCredential(client, {
    company_id: input.companyId,
    connector_id: GOOGLE_DRIVE_CONNECTOR_ID,
    status: "connected",
    encrypted_refresh_token: encryptSecret(tokens.refresh_token),
    access_token_expires_at: new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString(),
    scopes,
    account_email: accountEmail,
    connected_by_user_id: input.connectedByUserId ?? null,
    metadata: { provider: "google", access_type: "offline" },
  });

  return { accountEmail };
}

/**
 * Load stored refresh token, refresh access token, return usable credentials.
 * Falls back to env refresh token for local/dev without DB.
 */
export async function getGoogleDriveCredentials(
  config: GoogleDriveAuthConfig & { companyId?: string } = {},
  client?: AppSupabaseClient,
): Promise<GoogleDriveCredentials | null> {
  const companyId = config.companyId ?? getDefaultCompanyId();

  // Explicit config (tests / one-off)
  if (config.refreshToken && config.clientId && config.clientSecret) {
    const tokens = await refreshAccessToken(config.refreshToken);
    return {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      refreshToken: config.refreshToken,
    };
  }

  if (!isSupabaseConfigured()) {
    const envRefresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (!envRefresh) return null;
    try {
      const tokens = await refreshAccessToken(envRefresh);
      return {
        accessToken: tokens.access_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        refreshToken: envRefresh,
      };
    } catch {
      return null;
    }
  }

  const db = client ?? createServiceClient();
  const row = await getConnectorCredential(
    db,
    companyId,
    GOOGLE_DRIVE_CONNECTOR_ID,
  );
  if (!row?.encrypted_refresh_token || row.status !== "connected") {
    return null;
  }

  const refreshToken = decryptSecret(row.encrypted_refresh_token);
  const tokens = await refreshAccessToken(refreshToken);

  await updateConnectorCredential(db, companyId, GOOGLE_DRIVE_CONNECTOR_ID, {
    access_token_expires_at: new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString(),
  });

  return {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    refreshToken,
  };
}

export function isGoogleDriveAuthenticated(
  credentials: GoogleDriveCredentials | null,
): boolean {
  return credentials !== null && credentials.expiresAt > Date.now();
}

export async function disconnectGoogleDrive(input: {
  companyId: string;
  client?: AppSupabaseClient;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = input.client ?? createServiceClient();
  const row = await getConnectorCredential(
    client,
    input.companyId,
    GOOGLE_DRIVE_CONNECTOR_ID,
  );
  if (row?.encrypted_refresh_token) {
    try {
      const refreshToken = decryptSecret(row.encrypted_refresh_token);
      await revokeGoogleToken(refreshToken);
    } catch {
      // Best-effort revoke; still clear local credentials.
    }
  }
  await deleteConnectorCredential(
    client,
    input.companyId,
    GOOGLE_DRIVE_CONNECTOR_ID,
  );
}
