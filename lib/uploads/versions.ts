/**
 * Bump these when extractor or analyzer behavior changes so PROCESSED docs
 * become STALE and auto-enqueue for safe reprocessing.
 */
export const CURRENT_EXTRACTION_VERSION = "pdf-unpdf-v1";
export const CURRENT_ANALYSIS_VERSION = "insight-engine-v1";

/** Max automatic reprocess attempts after a version upgrade failure. */
export const MAX_REPROCESS_ATTEMPTS = 5;

/** Base delay for exponential backoff on reprocess failures (ms). */
export const REPROCESS_BACKOFF_BASE_MS = 30_000;

/** Cap backoff at 30 minutes. */
export const REPROCESS_BACKOFF_MAX_MS = 30 * 60 * 1000;

/** Bounded concurrency when draining stale/version-upgrade batches. */
export const STALE_REPROCESS_CONCURRENCY = 4;

/** Max docs to mark/enqueue per upgrade pass. */
export const STALE_REPROCESS_BATCH_LIMIT = 25;

export function isVersionBehind(
  stored: string | null | undefined,
  current: string,
): boolean {
  if (stored == null || stored === "") return true;
  return stored !== current;
}

export function documentNeedsVersionUpgrade(row: {
  last_successful_extraction_version?: string | null;
  last_successful_analysis_version?: string | null;
  extraction_version?: string | null;
  analysis_version?: string | null;
}): boolean {
  const extractOk = row.last_successful_extraction_version ?? row.extraction_version;
  const analysisOk = row.last_successful_analysis_version ?? row.analysis_version;
  return (
    isVersionBehind(extractOk, CURRENT_EXTRACTION_VERSION) ||
    isVersionBehind(analysisOk, CURRENT_ANALYSIS_VERSION)
  );
}

export function reprocessBackoffMs(attempt: number): number {
  const n = Math.max(1, attempt);
  const delay = REPROCESS_BACKOFF_BASE_MS * 2 ** (n - 1);
  return Math.min(delay, REPROCESS_BACKOFF_MAX_MS);
}

export function nextReprocessAtIso(
  attempt: number,
  now: Date = new Date(),
): string {
  return new Date(now.getTime() + reprocessBackoffMs(attempt)).toISOString();
}
