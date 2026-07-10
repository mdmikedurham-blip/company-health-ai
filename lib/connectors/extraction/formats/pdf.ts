import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, decodeUtf8, sectionId } from "./shared";

/**
 * PDF extraction (lightweight).
 * Prefer pre-exported plain text when available; otherwise decode bytes as UTF-8
 * and pull printable runs (full PDF.js parsing can replace this later).
 */
export function extractPdf(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const text =
    typeof content === "string"
      ? content
      : extractPrintableRuns(decodeUtf8(content));

  if (!text.trim()) {
    throw new Error("PDF produced no extractable text");
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
      ...sourceMetadata,
    },
    text: text.trim(),
  });
}

function extractPrintableRuns(decoded: string): string {
  const runs = decoded.match(/[\x20-\x7E\n\t]{4,}/g) ?? [];
  return runs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
