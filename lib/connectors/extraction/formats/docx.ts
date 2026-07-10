import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, sectionId } from "./shared";
import { readZipEntries, zipEntryText } from "./zip";

/**
 * DOCX extraction via OOXML ZIP (store or deflate) → word/document.xml text runs.
 */
export function extractDocx(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const text =
    typeof content === "string"
      ? content
      : extractDocxTextFromZip(content);

  if (!text.trim()) {
    throw new Error("DOCX produced no extractable text");
  }

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: DocumentSection[] = paragraphs.map((p, i) => ({
    id: sectionId("docx", i + 1),
    text: p,
    order: i + 1,
  }));

  return buildExtractedDocument({
    title,
    sections:
      sections.length > 0
        ? sections
        : [{ id: "docx-1", text: text.trim(), order: 1 }],
    metadata: {
      format: "DOCX",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ...sourceMetadata,
    },
    text: text.trim(),
  });
}

function extractDocxTextFromZip(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes);
  const xml = zipEntryText(entries, "word/document.xml");
  if (!xml) {
    throw new Error("DOCX is missing word/document.xml");
  }
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, "$1")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(withBreaks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
