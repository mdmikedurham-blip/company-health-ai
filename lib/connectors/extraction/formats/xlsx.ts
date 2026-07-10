import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, sectionId } from "./shared";
import {
  readZipEntries,
  zipEntriesMatching,
  zipEntryText,
  type ZipEntry,
} from "./zip";

/**
 * XLSX extraction: worksheet names, shared/inline cell values, sheet context.
 */
export function extractXlsx(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  if (typeof content === "string") {
    return buildExtractedDocument({
      title,
      sections: [
        {
          id: sectionId("sheet", 1),
          title: "Sheet",
          text: content.trim(),
          order: 1,
        },
      ],
      metadata: {
        format: "XLSX",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ...sourceMetadata,
      },
      text: content.trim(),
    });
  }

  const entries = readZipEntries(content);
  if (entries.length === 0) {
    throw new Error("XLSX archive is empty or malformed");
  }

  const sharedStrings = parseSharedStrings(
    zipEntryText(entries, "xl/sharedStrings.xml") ?? "",
  );
  const sheets = resolveSheets(entries);
  if (sheets.length === 0) {
    throw new Error("XLSX contains no worksheets");
  }

  const sections: DocumentSection[] = [];
  const textParts: string[] = [];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i]!;
    const xml = zipEntryText(entries, sheet.path);
    if (!xml) continue;
    const rows = extractSheetRows(xml, sharedStrings);
    const body =
      rows.length > 0
        ? rows.map((r) => r.join("\t")).join("\n")
        : "(empty sheet)";
    const order = i + 1;
    sections.push({
      id: sectionId("sheet", order),
      title: sheet.name,
      text: body,
      order,
      metadata: {
        sheet: sheet.name,
        sheetIndex: order,
        rowCount: rows.length,
      },
    });
    textParts.push(`## ${sheet.name}\n${body}`);
  }

  if (sections.length === 0) {
    throw new Error("XLSX worksheets produced no extractable content");
  }

  const text = textParts.join("\n\n").trim();
  return buildExtractedDocument({
    title,
    sections,
    metadata: {
      format: "XLSX",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sheetCount: sections.length,
      ...sourceMetadata,
    },
    text,
  });
}

type SheetRef = { name: string; path: string };

function resolveSheets(entries: ZipEntry[]): SheetRef[] {
  const workbook = zipEntryText(entries, "xl/workbook.xml") ?? "";
  const rels = zipEntryText(entries, "xl/_rels/workbook.xml.rels") ?? "";
  const ridToTarget = new Map<string, string>();
  for (const m of rels.matchAll(
    /Id="([^"]+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="([^"]+)"/g,
  )) {
    const id = m[1] ?? m[4];
    const target = m[2] ?? m[3];
    if (id && target) ridToTarget.set(id, target.replace(/^\//, ""));
  }

  const sheets: SheetRef[] = [];
  for (const m of workbook.matchAll(
    /<sheet\b[^>]*name="([^"]+)"[^>]*(?:r:id|rId)="([^"]+)"[^>]*\/>|<sheet\b[^>]*(?:r:id|rId)="([^"]+)"[^>]*name="([^"]+)"[^>]*\/>/g,
  )) {
    const name = m[1] ?? m[4] ?? "Sheet";
    const rid = m[2] ?? m[3];
    if (!rid) continue;
    let target = ridToTarget.get(rid) ?? `worksheets/sheet${sheets.length + 1}.xml`;
    if (!target.startsWith("xl/")) {
      target = `xl/${target.replace(/^\.\//, "")}`;
    }
    sheets.push({ name, path: target });
  }

  if (sheets.length > 0) return sheets;

  return zipEntriesMatching(entries, /^xl\/worksheets\/sheet\d+\.xml$/i).map(
    (e, i) => ({
      name: `Sheet${i + 1}`,
      path: e.name,
    }),
  );
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const inner = si[1] ?? "";
    const parts = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(
      (t) => decodeXml(t[1] ?? ""),
    );
    strings.push(parts.join(""));
  }
  return strings;
}

function extractSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[1] ?? "";
    const cells: string[] = [];
    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const type = typeMatch?.[1];
      const vMatch = body.match(/<v>([^<]*)<\/v>/);
      const isMatch = body.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
      let value = "";
      if (type === "s" && vMatch) {
        const idx = Number(vMatch[1]);
        value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr" && isMatch) {
        value = decodeXml(isMatch[1] ?? "");
      } else if (vMatch) {
        value = decodeXml(vMatch[1] ?? "");
      } else if (isMatch) {
        value = decodeXml(isMatch[1] ?? "");
      }
      cells.push(value);
    }
    if (cells.some((c) => c.trim().length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
