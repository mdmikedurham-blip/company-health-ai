import type { DocumentSection, ExtractedDocument } from "../types";
import {
  buildExtractedDocument,
  decodeUtf8,
  sectionId,
} from "./shared";

/** Parse a single CSV line with basic quoted-field support. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

/** CSV → header metadata + one section per data row. */
export function extractCsv(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  const raw = typeof content === "string" ? content : decodeUtf8(content);
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return buildExtractedDocument({
      title,
      sections: [],
      metadata: {
        format: "CSV",
        mimeType: "text/csv",
        rowCount: 0,
        ...sourceMetadata,
      },
      text: "",
    });
  }

  const headers = parseCsvLine(lines[0]!);
  const sections: DocumentSection[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const pairs = headers.map((h, idx) => `${h}: ${values[idx] ?? ""}`);
    const order = i;
    sections.push({
      id: sectionId("csv", order),
      title: values[0] || `Row ${order}`,
      text: pairs.join("\n"),
      order,
      metadata: { row: order },
    });
  }

  return buildExtractedDocument({
    title,
    sections,
    metadata: {
      format: "CSV",
      mimeType: "text/csv",
      rowCount: Math.max(0, lines.length - 1),
      columns: headers.join(","),
      ...sourceMetadata,
    },
    text: raw.trim(),
  });
}
