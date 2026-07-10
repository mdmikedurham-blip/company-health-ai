import type { DocumentSection, ExtractedDocument } from "../types";
import {
  buildExtractedDocument,
  decodeUtf8,
  sectionId,
} from "./shared";

/**
 * Google Slides — exported as plain text.
 * Split on form-feed / "Slide N" markers when present; otherwise blank lines.
 */
export function extractGoogleSlides(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const raw =
    typeof content === "string" ? content : decodeUtf8(content);
  const text = raw.replace(/\r\n/g, "\n").trim();

  let chunks: string[];
  if (text.includes("\f")) {
    chunks = text.split("\f").map((c) => c.trim()).filter(Boolean);
  } else {
    const slideSplit = text.split(/(?=^Slide\s+\d+)/im);
    chunks =
      slideSplit.length > 1
        ? slideSplit.map((c) => c.trim()).filter(Boolean)
        : text
            .split(/\n{2,}/)
            .map((c) => c.trim())
            .filter(Boolean);
  }

  const sections: DocumentSection[] = chunks.map((chunk, i) => {
    const order = i + 1;
    const firstLine = chunk.split("\n")[0] ?? `Slide ${order}`;
    const slideTitle = /^Slide\s+\d+/i.test(firstLine)
      ? firstLine
      : `Slide ${order}`;
    const body = /^Slide\s+\d+/i.test(firstLine)
      ? chunk.slice(firstLine.length).trim()
      : chunk;
    return {
      id: sectionId("slide", order),
      title: slideTitle,
      text: body || chunk,
      order,
      metadata: { slide: order },
    };
  });

  return buildExtractedDocument({
    title,
    sections:
      sections.length > 0
        ? sections
        : [{ id: "slide-1", title: "Slide 1", text, order: 1 }],
    metadata: {
      format: "Google Slides",
      mimeType: "application/vnd.google-apps.presentation",
      slideCount: sections.length || 1,
      ...sourceMetadata,
    },
    text,
  });
}
