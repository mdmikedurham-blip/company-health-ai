/**
 * Rate-limiting extension points for auth and OAuth endpoints.
 * Wire a Redis / Upstash / edge limiter here without changing call sites.
 */

export type RateLimitKey =
  | "auth.signup"
  | "auth.login"
  | "auth.forgot_password"
  | "auth.reset_password"
  | "oauth.google_drive.authorize"
  | "oauth.google_drive.callback";

export type RateLimitResult = {
  allowed: boolean;
  remaining?: number;
  retryAfterSeconds?: number;
};

/**
 * Default: allow all. Replace with a real limiter in production.
 * Example: check Redis counter keyed by `${key}:${ip}`.
 */
export async function checkRateLimit(
  key: RateLimitKey,
  identity: string,
): Promise<RateLimitResult> {
  void key;
  void identity;
  return { allowed: true };
}

export function rateLimitExceededResponse(
  result: RateLimitResult,
): {
  error: string;
  status: number;
} {
  void result;
  return {
    error: "Too many attempts. Please wait and try again.",
    status: 429,
  };
}
