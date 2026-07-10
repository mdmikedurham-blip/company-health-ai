import type { DocumentSection, ExtractedDocument } from "../types";

export function joinSections(sections: DocumentSection[]): string {
  return sections
    .map((s) => (s.title ? `${s.title}\n${s.text}` : s.text))
    .filter((t) => t.trim().length > 0)
    .join("\n\n");
}

export function buildExtractedDocument(input: {
  title: string;
  sections: DocumentSection[];
  metadata: Record<string, string | number | boolean | null>;
  text?: string;
}): ExtractedDocument {
  const text = input.text ?? joinSections(input.sections);
  return {
    text,
    title: input.title,
    metadata: input.metadata,
    sections: input.sections,
  };
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function sectionId(prefix: string, order: number): string {
  return `${prefix}-${order}`;
}
