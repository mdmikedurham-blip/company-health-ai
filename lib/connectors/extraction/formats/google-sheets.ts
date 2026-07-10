import type { ExtractedDocument } from "../types";
import { extractCsv } from "./csv";

/** Google Sheets — exported as CSV; one section per data row. */
export function extractGoogleSheets(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const base = extractCsv(title, content, sourceMetadata);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      format: "Google Sheets",
      mimeType: "application/vnd.google-apps.spreadsheet",
      ...sourceMetadata,
    },
  };
}
