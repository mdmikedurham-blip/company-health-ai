import type { ExtractedDocument } from "../types";
import { extractMarkdown } from "./markdown";
import { extractTxt } from "./txt";

/**
 * Google Docs — typically exported as text/plain or text/markdown.
 * Prefer markdown sectioning when headings are present.
 */
export function extractGoogleDocs(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const asString =
    typeof content === "string"
      ? content
      : new TextDecoder("utf-8", { fatal: false }).decode(content);
  const looksMarkdown =
    /^#{1,6}\s+/m.test(asString) || /\n#{1,6}\s+/.test(asString);
  const base = looksMarkdown
    ? extractMarkdown(title, asString, sourceMetadata)
    : extractTxt(title, asString, sourceMetadata);

  return {
    ...base,
    metadata: {
      ...base.metadata,
      format: "Google Docs",
      mimeType: "application/vnd.google-apps.document",
      ...sourceMetadata,
    },
  };
}
