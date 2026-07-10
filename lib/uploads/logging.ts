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
