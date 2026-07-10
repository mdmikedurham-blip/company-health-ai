import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, decodeUtf8, sectionId } from "./shared";

/**
 * DOCX extraction.
 * When Drive/export already provided plain text, section it.
 * For raw .docx bytes, pull `<w:t>` runs from word/document.xml inside the zip.
 */
export function extractDocx(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const text =
    typeof content === "string"
      ? content
      : extractDocxTextFromZip(content) || decodeUtf8(content);

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
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

/** Minimal ZIP local-file scan for word/document.xml + <w:t> text runs. */
function extractDocxTextFromZip(bytes: Uint8Array): string {
  const xml = findZipEntryText(bytes, "word/document.xml");
  if (!xml) return "";
  const runs = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? "");
  // Paragraph breaks roughly follow </w:p>
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, "$1")
    .replace(/<[^>]+>/g, "");
  const cleaned = decodeXmlEntities(withBreaks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || runs.join(" ").trim();
}

function findZipEntryText(bytes: Uint8Array, path: string): string | null {
  const nameBytes = new TextEncoder().encode(path);
  for (let i = 0; i < bytes.length - 30; i++) {
    // Local file header signature PK\x03\x04
    if (
      bytes[i] !== 0x50 ||
      bytes[i + 1] !== 0x4b ||
      bytes[i + 2] !== 0x03 ||
      bytes[i + 3] !== 0x04
    ) {
      continue;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + i, 30);
    const compression = view.getUint16(8, true);
    const compSize = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true);
    const extraLen = view.getUint16(28, true);
    const nameStart = i + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.length) continue;
    const entryName = bytes.subarray(nameStart, nameEnd);
    if (!namesEqual(entryName, nameBytes)) continue;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) return null;
    // Only store uncompressed (method 0) — typical for small test fixtures;
    // production should export DOCX as text/plain via Drive export.
    if (compression !== 0) return null;
    return decodeUtf8(bytes.subarray(dataStart, dataEnd));
  }
  return null;
}

function namesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
