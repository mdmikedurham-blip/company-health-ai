import type {
  ExtractDocumentInput,
  ExtractedDocument,
  ExtractableMimeType,
} from "./types";
import { extractCsv } from "./formats/csv";
import { extractDocx } from "./formats/docx";
import { extractGoogleDocs } from "./formats/google-docs";
import { extractGoogleSheets } from "./formats/google-sheets";
import { extractGoogleSlides } from "./formats/google-slides";
import { extractMarkdown } from "./formats/markdown";
import { extractPdf } from "./formats/pdf";
import { extractTxt } from "./formats/txt";

const EXTRACTORS: Record<
  ExtractableMimeType,
  (
    title: string,
    content: string | Uint8Array,
    meta: Record<string, string | number | boolean | null>,
  ) => ExtractedDocument
> = {
  "application/pdf": extractPdf,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    extractDocx,
  "application/vnd.google-apps.document": extractGoogleDocs,
  "application/vnd.google-apps.spreadsheet": extractGoogleSheets,
  "application/vnd.google-apps.presentation": extractGoogleSlides,
  "text/plain": extractTxt,
  "text/markdown": extractMarkdown,
  "text/csv": extractCsv,
};

export function isExtractableMimeType(
  mimeType: string,
): mimeType is ExtractableMimeType {
  return mimeType in EXTRACTORS;
}

/**
 * Route a file payload to the format extractor.
 * Each supported type produces the same ExtractedDocument shape.
 */
export function extractDocument(input: ExtractDocumentInput): ExtractedDocument {
  const { title, mimeType, sourceMetadata = {} } = input;
  if (!isExtractableMimeType(mimeType)) {
    throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
  }

  const content =
    input.text !== undefined
      ? input.text
      : input.bytes !== undefined
        ? input.bytes
        : "";

  return EXTRACTORS[mimeType](title, content, sourceMetadata);
}

export type {
  DocumentSection,
  ExtractDocumentInput,
  ExtractedDocument,
  ExtractableMimeType,
} from "./types";
export { extractCsv } from "./formats/csv";
export { extractDocx } from "./formats/docx";
export { extractGoogleDocs } from "./formats/google-docs";
export { extractGoogleSheets } from "./formats/google-sheets";
export { extractGoogleSlides } from "./formats/google-slides";
export { extractMarkdown } from "./formats/markdown";
export { extractPdf } from "./formats/pdf";
export { extractTxt } from "./formats/txt";
