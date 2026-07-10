import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Server-only secret for internal document processing kickoff.
 * Order: DOCUMENT_PROCESS_SECRET → CRON_SECRET → derived from service role key.
 * The service-role fallback ensures production kickoff works without an extra env var.
 */
export function getDocumentProcessSecret(): string | null {
  const dedicated = process.env.DOCUMENT_PROCESS_SECRET?.trim();
  if (dedicated) return dedicated;

  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole) {
    return createHash("sha256")
      .update(`company-health-document-process:${serviceRole}`)
      .digest("hex");
  }

  return null;
}

/** True when Authorization Bearer matches the process secret. */
export function isAuthorizedProcessSecret(request: Request): boolean {
  const secret = getDocumentProcessSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
