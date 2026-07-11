/**
 * PDF text extraction via unpdf (pdf.js) with quality gates.
 * Rejects object-stream junk; marks scanned PDFs as OCR_REQUIRED.
 */

import { extractText, getDocumentProxy } from "unpdf";
import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, decodeUtf8, sectionId } from "./shared";
import { isLowQualityPdfText, looksLikeBinaryOrPdfJunk } from "../text-quality";
import { PdfExtractionError } from "../pdf-errors";

/** Soft cap — larger files still attempted but flagged for quality checks. */
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

/**
 * PDF extraction.
 * - Plain-text inputs (pre-exported) accepted when not PDF junk.
 * - Binary PDFs: unpdf/pdf.js text extraction.
 * - Scanned / image-only PDFs → OCR_REQUIRED (not generic FAILED).
 * - Object-stream / malformed output fails with an exact reason.
 */
export async function extractPdf(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): Promise<ExtractedDocument> {
  let text: string;
  let method: string;
  let pageCount: number | null = null;

  if (typeof content === "string") {
    text = content.replace(/\r\n/g, "\n").trim();
    method = "plain-text";
    if (!text) {
      throw new PdfExtractionError(
        "EMPTY_TEXT",
        "PDF produced no extractable text",
      );
    }
    if (isLowQualityPdfText(text) || looksLikeBinaryOrPdfJunk(text)) {
      throw new PdfExtractionError(
        "OBJECT_STREAMS",
        "PDF text extraction failed: content looks like PDF object streams or binary data, not readable document text",
        "This PDF could not be read as text (object streams / binary junk).",
      );
    }
  } else {
    if (content.byteLength === 0) {
      throw new PdfExtractionError(
        "EMPTY_TEXT",
        "PDF file is empty",
        "PDF file is empty.",
      );
    }
    if (content.byteLength > PDF_MAX_BYTES) {
      throw new PdfExtractionError(
        "FILE_TOO_LARGE",
        `PDF exceeds ${PDF_MAX_BYTES} bytes`,
        "PDF is too large to process.",
      );
    }
    if (!looksLikePdfHeader(content)) {
      throw new PdfExtractionError(
        "INVALID_PDF",
        "File does not start with a PDF header (%PDF-)",
        "File is not a valid PDF.",
      );
    }

    const result = await extractTextWithUnpdf(content);
    pageCount = result.pageCount;
    text = result.text.trim();
    method = "unpdf";

    if (!text) {
      if (result.likelyScanned) {
        throw new PdfExtractionError(
          "OCR_REQUIRED",
          "PDF appears to be scanned or image-only; OCR is required",
          "This PDF looks scanned. OCR is required before it can be analyzed.",
        );
      }
      throw new PdfExtractionError(
        "EMPTY_TEXT",
        "PDF produced no extractable text",
        "PDF produced no extractable text.",
      );
    }

    if (isLowQualityPdfText(text) || looksLikeBinaryOrPdfJunk(text)) {
      throw new PdfExtractionError(
        "OBJECT_STREAMS",
        "PDF text extraction failed: content looks like PDF object streams or binary data, not readable document text",
        "This PDF could not be read as text (object streams / binary junk).",
      );
    }

    // Very short text on a multi-page PDF often means image-only pages.
    if (
      result.pageCount >= 2 &&
      text.replace(/\s+/g, " ").trim().length < 40 &&
      result.likelyScanned
    ) {
      throw new PdfExtractionError(
        "OCR_REQUIRED",
        "PDF appears to be scanned or image-only; OCR is required",
        "This PDF looks scanned. OCR is required before it can be analyzed.",
      );
    }
  }

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: DocumentSection[] = paragraphs.map((p, i) => ({
    id: sectionId("pdf", i + 1),
    text: p,
    order: i + 1,
  }));

  return buildExtractedDocument({
    title,
    sections:
      sections.length > 0
        ? sections
        : [{ id: "pdf-1", text: text.trim(), order: 1 }],
    metadata: {
      format: "PDF",
      mimeType: "application/pdf",
      extractionMethod: method,
      extractionQuality: "ok",
      ...(pageCount != null ? { pageCount } : {}),
      ...sourceMetadata,
    },
    text: text.trim(),
  });
}

function looksLikePdfHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  const head = decodeUtf8(bytes.subarray(0, 8));
  return head.startsWith("%PDF-");
}

async function extractTextWithUnpdf(bytes: Uint8Array): Promise<{
  text: string;
  pageCount: number;
  likelyScanned: boolean;
}> {
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PdfExtractionError(
      "MALFORMED_PDF",
      `Malformed PDF: ${msg}`,
      `Malformed PDF: ${msg.slice(0, 200)}`,
    );
  }

  let totalPages = 0;
  let merged = "";
  try {
    const extracted = await extractText(pdf, { mergePages: true });
    totalPages = extracted.totalPages ?? 0;
    const rawText = extracted.text as unknown;
    merged =
      typeof rawText === "string"
        ? rawText
        : Array.isArray(rawText)
          ? (rawText as string[]).join("\n\n")
          : String(rawText ?? "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PdfExtractionError(
      "MALFORMED_PDF",
      `PDF text parse failed: ${msg}`,
      `PDF could not be parsed: ${msg.slice(0, 200)}`,
    );
  }

  const cleaned = merged.replace(/\r\n/g, "\n").trim();
  const latin = Buffer.from(bytes).toString("latin1");
  const imageHits = (latin.match(/\/Subtype\s*\/Image\b/g) ?? []).length;
  const fontHits = (latin.match(/\/Font\b/g) ?? []).length;
  const likelyScanned =
    cleaned.length < 40 && (imageHits >= 1 || (totalPages >= 1 && fontHits === 0));

  return {
    text: cleaned,
    pageCount: totalPages,
    likelyScanned,
  };
}
