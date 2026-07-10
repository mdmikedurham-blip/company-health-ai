import { timingSafeEqual } from "node:crypto";

/**
 * Server-only secret for internal document processing kickoff.
 * Prefers DOCUMENT_PROCESS_SECRET; falls back to CRON_SECRET.
 */
export function getDocumentProcessSecret(): string | null {
  const dedicated = process.env.DOCUMENT_PROCESS_SECRET?.trim();
  if (dedicated) return dedicated;
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;
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
