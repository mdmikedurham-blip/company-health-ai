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
import { extractPptx } from "./formats/pptx";
import { extractTxt } from "./formats/txt";
import { extractXlsx } from "./formats/xlsx";

type SyncExtractor = (
  title: string,
  content: string | Uint8Array,
  meta: Record<string, string | number | boolean | null>,
) => ExtractedDocument;

type AsyncExtractor = (
  title: string,
  content: string | Uint8Array,
  meta: Record<string, string | number | boolean | null>,
) => Promise<ExtractedDocument>;

const SYNC_EXTRACTORS: Partial<Record<ExtractableMimeType, SyncExtractor>> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    extractDocx,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    extractPptx,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    extractXlsx,
  "application/vnd.google-apps.document": extractGoogleDocs,
  "application/vnd.google-apps.spreadsheet": extractGoogleSheets,
  "application/vnd.google-apps.presentation": extractGoogleSlides,
  "text/plain": extractTxt,
  "text/markdown": extractMarkdown,
  "text/csv": extractCsv,
};

const ASYNC_EXTRACTORS: Partial<Record<ExtractableMimeType, AsyncExtractor>> = {
  "application/pdf": extractPdf,
};

export function isExtractableMimeType(
  mimeType: string,
): mimeType is ExtractableMimeType {
  return mimeType in SYNC_EXTRACTORS || mimeType in ASYNC_EXTRACTORS;
}

/**
 * Route a file payload to the format extractor.
 * Each supported type produces the same ExtractedDocument shape.
 * PDF extraction is async (unpdf / pdf.js).
 */
export async function extractDocument(
  input: ExtractDocumentInput,
): Promise<ExtractedDocument> {
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

  const asyncExtractor = ASYNC_EXTRACTORS[mimeType];
  if (asyncExtractor) {
    return asyncExtractor(title, content, sourceMetadata);
  }

  const syncExtractor = SYNC_EXTRACTORS[mimeType];
  if (!syncExtractor) {
    throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
  }
  return syncExtractor(title, content, sourceMetadata);
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
export { extractPptx } from "./formats/pptx";
export { extractTxt } from "./formats/txt";
export { extractXlsx } from "./formats/xlsx";
export {
  FINANCIAL_FACT_KEYS,
  MIN_FINANCIAL_FACTS_TO_SCORE,
  countFinancialFacts,
  extractFinancialObservations,
  hasEnoughFinancialFacts,
  mergeFinancialFactsInto,
  missingFinancialFactKeys,
} from "./financial-facts";
export type {
  FinancialBasis,
  FinancialFactKey,
  FinancialMetricObservation,
} from "./financial-facts";
export {
  GOVERNANCE_FACT_KEYS,
  MIN_GOVERNANCE_FACTS_TO_SCORE,
  countGovernanceFacts,
  extractGovernanceFactsFromText,
  hasEnoughGovernanceFacts,
  mergeGovernanceFactsInto,
} from "./governance-facts";
export type { GovernanceFactKey } from "./governance-facts";
export {
  isLowQualityPdfText,
  looksLikeBinaryOrPdfJunk,
  pdfSyntaxLineRatio,
} from "./text-quality";
export {
  PdfExtractionError,
  isOcrRequiredError,
  isPdfExtractionError,
} from "./pdf-errors";
export type { PdfFailureCode } from "./pdf-errors";
