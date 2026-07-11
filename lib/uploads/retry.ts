/**
 * Retry helpers for transient DB conflicts during company analysis persistence.
 */

export function isTransientDbConflict(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("could not serialize") ||
    lower.includes("deadlock detected") ||
    lower.includes("40001") ||
    lower.includes("40p01") ||
    lower.includes("23505")
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 100;
  const shouldRetry = options?.shouldRetry ?? isTransientDbConflict;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}
