/**
 * PDF text extraction with FlateDecode stream inflate + text operators.
 * Rejects object-stream / binary junk rather than treating it as evidence.
 */

import { inflateRawSync, inflateSync } from "node:zlib";
import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, decodeUtf8, sectionId } from "./shared";
import { isLowQualityPdfText, looksLikeBinaryOrPdfJunk } from "../text-quality";

/**
 * PDF extraction.
 * - Plain-text inputs (pre-exported) accepted when not PDF junk.
 * - Binary PDFs: inflate FlateDecode streams and parse Tj/TJ/'/" operators.
 * - Low-quality / object-stream output fails rather than becoming evidence.
 */
export function extractPdf(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  let text: string;
  let method: string;

  if (typeof content === "string") {
    text = content.replace(/\r\n/g, "\n").trim();
    method = "plain-text";
  } else {
    const fromStreams = extractTextFromPdfBytes(content);
    if (fromStreams.trim().length >= 40 && !isLowQualityPdfText(fromStreams)) {
      text = fromStreams.trim();
      method = "content-streams";
    } else {
      // Last resort: printable runs — only if they pass quality gate.
      const fallback = extractPrintableRuns(decodeUtf8(content));
      text = fallback.trim();
      method = "printable-runs";
    }
  }

  if (!text) {
    throw new Error("PDF produced no extractable text");
  }

  if (isLowQualityPdfText(text) || looksLikeBinaryOrPdfJunk(text)) {
    throw new Error(
      "PDF text extraction failed: content looks like PDF object streams or binary data, not readable document text",
    );
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
      ...sourceMetadata,
    },
    text: text.trim(),
  });
}

function extractPrintableRuns(decoded: string): string {
  const runs = decoded.match(/[\x20-\x7E\n\t]{4,}/g) ?? [];
  return runs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Walk PDF bytes for `stream`…`endstream` pairs. When the preceding dictionary
 * includes /FlateDecode, inflate and pull text-showing operators.
 */
export function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const latin = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(latin)) !== null) {
    const body = match[1] ?? "";
    const dictStart = latin.lastIndexOf("<<", match.index);
    const dict =
      dictStart >= 0 ? latin.slice(dictStart, match.index) : "";
    const isFlate = /\/Filter\s*\/FlateDecode|\/Filter\s*\[\s*\/FlateDecode/.test(
      dict,
    );
    let decoded = body;
    if (isFlate) {
      const raw = Buffer.from(body.replace(/^\r?\n/, "").replace(/\r?\n$/, ""), "latin1");
      try {
        decoded = inflateSync(raw).toString("utf8");
      } catch {
        try {
          decoded = inflateRawSync(raw).toString("utf8");
        } catch {
          continue;
        }
      }
    }
    const ops = extractPdfTextOperators(decoded);
    if (ops) chunks.push(ops);
  }

  // Also try operators on uncompressed page content embedded as literal text
  // (rare, but helps simple synthetic PDFs in tests).
  const direct = extractPdfTextOperators(latin);
  if (direct) chunks.push(direct);

  return chunks
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract strings from PDF text operators: Tj, TJ, ', ". */
export function extractPdfTextOperators(content: string): string {
  const parts: string[] = [];

  // (Hello World) Tj   or   (Hello World)'
  const literalRe = /\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(content)) !== null) {
    const raw = m[0];
    const lit = raw.match(/^\(((?:\\.|[^\\)])*)\)/);
    if (lit?.[1] != null) parts.push(unescapePdfString(lit[1]));
  }

  // [ (a) 120 (b) ] TJ
  const arrayRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = arrayRe.exec(content)) !== null) {
    const inner = m[1] ?? "";
    const strRe = /\((?:\\.|[^\\)])*\)/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(inner)) !== null) {
      const body = s[0].slice(1, -1);
      parts.push(unescapePdfString(body));
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8)),
    );
}
