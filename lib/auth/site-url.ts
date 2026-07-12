/**
 * Public site origin helpers for auth email redirects.
 * Production must never emit localhost redirect URLs.
 */

export const PRODUCTION_SITE_URL = "https://company-health-ai.vercel.app";

export const PASSWORD_UPDATE_PATH = "/auth/update-password";

/** Post-success landing after a password update. */
export const PASSWORD_UPDATE_SUCCESS_PATH = "/login?reset=1";

export const PASSWORD_RESET_ACCEPTED_MESSAGE =
  "If an account exists for this email, a password-reset link has been requested. Delivery can take a few minutes.";

type EnvLike = Record<string, string | undefined>;

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

function isProductionRuntime(env: EnvLike): boolean {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

/**
 * Resolve the public site origin used in auth emails / OAuth redirects.
 * Prefers NEXT_PUBLIC_SITE_URL. In production, never falls back to localhost.
 */
export function resolveSiteOrigin(env: EnvLike = process.env): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "").trim();

  if (configured) {
    if (isProductionRuntime(env) && isLocalhostOrigin(configured)) {
      return PRODUCTION_SITE_URL;
    }
    return configured;
  }

  if (isProductionRuntime(env)) {
    return PRODUCTION_SITE_URL;
  }

  if (env.VERCEL_URL) {
    const host = env.VERCEL_URL.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }

  return "http://localhost:3000";
}

/** Absolute redirectTo for password recovery emails. */
export function passwordResetRedirectTo(env: EnvLike = process.env): string {
  const origin = resolveSiteOrigin(env);
  return `${origin}${PASSWORD_UPDATE_PATH}`;
}
