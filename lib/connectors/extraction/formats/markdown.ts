import type { DocumentSection, ExtractedDocument } from "../types";
import {
  buildExtractedDocument,
  decodeUtf8,
  sectionId,
} from "./shared";

/** Split Markdown on ATX headings (# … ######). */
export function extractMarkdown(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const raw = typeof content === "string" ? content : decodeUtf8(content);
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const sections: DocumentSection[] = [];
  let currentTitle: string | undefined;
  let currentLines: string[] = [];
  let order = 0;

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (!currentTitle && !body) return;
    order += 1;
    sections.push({
      id: sectionId("md", order),
      title: currentTitle,
      text: body,
      order,
      metadata: currentTitle ? { heading: currentTitle } : undefined,
    });
    currentTitle = undefined;
    currentLines = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      currentTitle = heading[2]?.trim();
      continue;
    }
    currentLines.push(line);
  }
  flush();

  return buildExtractedDocument({
    title,
    sections:
      sections.length > 0
        ? sections
        : [{ id: "md-1", text, order: 1 }],
    metadata: {
      format: "Markdown",
      mimeType: "text/markdown",
      ...sourceMetadata,
    },
    text,
  });
}
