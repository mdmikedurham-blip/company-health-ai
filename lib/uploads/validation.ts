import {
  MANUAL_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  mimeFromFilename,
  type ManualUploadMimeType,
} from "./constants";

export type UploadValidationResult =
  | {
      ok: true;
      filename: string;
      mimeType: ManualUploadMimeType;
      byteSize: number;
    }
  | { ok: false; error: string };

const MIME_SET = new Set<string>(MANUAL_UPLOAD_MIME_TYPES);

/** Strip path segments and normalize to a safe basename. */
export function sanitizeUploadFilename(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/^\.+/, "")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "upload.bin";
  return cleaned.slice(0, 180);
}

export function buildStoragePath(input: {
  companyId: string;
  documentId: string;
  filename: string;
}): string {
  const safe = sanitizeUploadFilename(input.filename);
  return `${input.companyId}/${input.documentId}/${safe}`;
}

export function validateUploadRequest(input: {
  filename: string;
  mimeType?: string | null;
  byteSize: number;
}): UploadValidationResult {
  const filename = sanitizeUploadFilename(input.filename);
  if (!filename) {
    return { ok: false, error: "Filename is required." };
  }

  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return { ok: false, error: "File is empty." };
  }

  if (input.byteSize > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  const fromName = mimeFromFilename(filename);
  const declared = (input.mimeType ?? "").trim().toLowerCase();
  let mimeType: ManualUploadMimeType | null = null;

  if (declared && MIME_SET.has(declared)) {
    mimeType = declared as ManualUploadMimeType;
  } else if (fromName) {
    mimeType = fromName;
  }

  if (!mimeType) {
    return {
      ok: false,
      error: "Unsupported file type. Use PDF, DOCX, PPTX, XLSX, TXT, or CSV.",
    };
  }

  // Prefer extension when both are present and disagree (browsers often send octet-stream).
  if (fromName && declared && MIME_SET.has(declared) && fromName !== declared) {
    mimeType = fromName;
  }

  return { ok: true, filename, mimeType, byteSize: input.byteSize };
}
