import type { DocumentSection, ExtractedDocument } from "../types";
import {
  buildExtractedDocument,
  decodeUtf8,
  sectionId,
} from "./shared";

/** Split plain text on blank lines into sections. */
export function extractTxt(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const text = typeof content === "string" ? content : decodeUtf8(content);
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections: DocumentSection[] = blocks.map((block, i) => {
    const order = i + 1;
    const firstLine = block.split("\n")[0] ?? `Section ${order}`;
    const hasTitle = block.includes("\n") && firstLine.length < 120;
    return {
      id: sectionId("txt", order),
      title: hasTitle ? firstLine : undefined,
      text: hasTitle ? block.slice(firstLine.length).trim() || block : block,
      order,
    };
  });

  return buildExtractedDocument({
    title,
    sections:
      sections.length > 0
        ? sections
        : [{ id: "txt-1", text: text.trim(), order: 1 }],
    metadata: {
      format: "TXT",
      mimeType: "text/plain",
      ...sourceMetadata,
    },
    text: text.trim(),
  });
}
