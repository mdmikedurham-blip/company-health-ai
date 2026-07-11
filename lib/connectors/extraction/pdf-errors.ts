export type PdfFailureCode =
  | "OCR_REQUIRED"
  | "MALFORMED_PDF"
  | "EMPTY_TEXT"
  | "OBJECT_STREAMS"
  | "LOW_QUALITY"
  | "TIMEOUT"
  | "FILE_TOO_LARGE"
  | "INVALID_PDF";

export class PdfExtractionError extends Error {
  readonly code: PdfFailureCode;
  readonly userMessage: string;

  constructor(code: PdfFailureCode, message: string, userMessage?: string) {
    super(message);
    this.name = "PdfExtractionError";
    this.code = code;
    this.userMessage = userMessage ?? message;
  }
}

export function isPdfExtractionError(err: unknown): err is PdfExtractionError {
  return err instanceof PdfExtractionError;
}

export function isOcrRequiredError(err: unknown): boolean {
  return isPdfExtractionError(err) && err.code === "OCR_REQUIRED";
}
