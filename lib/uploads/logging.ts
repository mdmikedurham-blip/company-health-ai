/**
 * Structured processing logs — never include file contents or secrets.
 */
export function logUploadProcessingEvent(
  event: string,
  fields: {
    documentId?: string;
    companyId?: string;
    stage?: string;
    outcome?: string;
    status?: string;
    errorMessage?: string;
    httpStatus?: number;
    [key: string]: string | number | boolean | undefined;
  },
): void {
  console.info(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

/** Full exception dump for worker catch paths (message + stack). */
export function logUploadProcessingException(
  event: string,
  fields: {
    documentId: string;
    companyId: string;
    filename?: string | null;
    mimeType?: string | null;
    stage: string;
    err: unknown;
  },
): void {
  const error =
    fields.err instanceof Error
      ? fields.err
      : new Error(typeof fields.err === "string" ? fields.err : String(fields.err));
  const stack =
    error.stack ??
    (fields.err instanceof Error
      ? undefined
      : `Non-Error throw: ${JSON.stringify(fields.err)}`);

  console.error(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      documentId: fields.documentId,
      companyId: fields.companyId,
      filename: fields.filename ?? undefined,
      mimeType: fields.mimeType ?? undefined,
      stage: fields.stage,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: stack,
    }),
  );
}
