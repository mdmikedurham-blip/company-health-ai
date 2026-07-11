/**
 * Evidence primary keys are uuid columns. Manual-upload historically used
 * `upload-${documentId}` which Postgres rejects — canonicalize to the UUID.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Legacy synthetic prefixes that must never be written to uuid columns. */
const LEGACY_EVIDENCE_PREFIXES = ["upload-", "upload:"] as const;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Returns a bare UUID for evidence.id / document_id columns.
 * Strips legacy `upload-` / `upload:` prefixes when the remainder is a UUID.
 * Throws if the value cannot be resolved to a UUID.
 */
export function canonicalizeEvidenceUuid(
  value: string,
  context = "evidence.id",
): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error(`${context}: empty id (expected uuid)`);
  }
  if (isUuid(raw)) return raw;

  for (const prefix of LEGACY_EVIDENCE_PREFIXES) {
    if (raw.toLowerCase().startsWith(prefix)) {
      const rest = raw.slice(prefix.length);
      if (isUuid(rest)) return rest;
    }
  }

  throw new Error(
    `${context}: invalid uuid ${JSON.stringify(raw)} (strip upload- prefix and use document.id)`,
  );
}

/** Text-only provenance key — never write this to a uuid column. */
export function manualUploadExternalKey(documentId: string): string {
  const uuid = canonicalizeEvidenceUuid(documentId, "manualUploadExternalKey");
  return `upload:${uuid}`;
}
