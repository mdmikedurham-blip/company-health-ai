import type { DocumentSection, ExtractedDocument } from "../types";
import { buildExtractedDocument, sectionId } from "./shared";
import { readZipEntries, zipEntriesMatching } from "./zip";

/**
 * PPTX extraction: slide text, slide number, speaker notes when present.
 */
export function extractPptx(
  title: string,
  content: string | Uint8Array,
  sourceMetadata: Record<string, string | number | boolean | null> = {},
): ExtractedDocument {
  if (typeof content === "string") {
    return buildExtractedDocument({
      title,
      sections: [
        {
          id: sectionId("slide", 1),
          title: "Slide 1",
          text: content.trim(),
          order: 1,
          metadata: { slide: 1 },
        },
      ],
      metadata: {
        format: "PPTX",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        slideCount: 1,
        ...sourceMetadata,
      },
      text: content.trim(),
    });
  }

  const entries = readZipEntries(content);
  if (entries.length === 0) {
    throw new Error("PPTX archive is empty or malformed");
  }

  const slides = zipEntriesMatching(
    entries,
    /^ppt\/slides\/slide\d+\.xml$/i,
  );
  if (slides.length === 0) {
    throw new Error("PPTX contains no slides");
  }

  const notesBySlide = new Map<number, string>();
  for (const note of zipEntriesMatching(
    entries,
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/i,
  )) {
    const num = Number(note.name.match(/notesSlide(\d+)/i)?.[1] ?? 0);
    if (!num) continue;
    const text = extractAText(new TextDecoder().decode(note.data));
    if (text.trim()) notesBySlide.set(num, text.trim());
  }

  const sections: DocumentSection[] = [];
  const textParts: string[] = [];

  for (const slide of slides) {
    const num = Number(slide.name.match(/slide(\d+)/i)?.[1] ?? 0) || sections.length + 1;
    const xml = new TextDecoder().decode(slide.data);
    const slideText = extractAText(xml).trim();
    const notes = notesBySlide.get(num);
    const body = notes
      ? `${slideText || "(no slide text)"}\n\nSpeaker notes:\n${notes}`
      : slideText || "(no slide text)";

    sections.push({
      id: sectionId("slide", num),
      title: `Slide ${num}`,
      text: body,
      order: num,
      metadata: {
        slide: num,
        hasNotes: Boolean(notes),
      },
    });
    textParts.push(
      notes
        ? `## Slide ${num}\n${slideText}\n\nNotes: ${notes}`
        : `## Slide ${num}\n${slideText}`,
    );
  }

  if (sections.length === 0) {
    throw new Error("PPTX slides produced no extractable content");
  }

  // Prefer Content_Types / presentation order already via numeric sort.
  sections.sort((a, b) => a.order - b.order);
  const text = textParts.join("\n\n").trim();

  return buildExtractedDocument({
    title,
    sections,
    metadata: {
      format: "PPTX",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      slideCount: sections.length,
      ...sourceMetadata,
    },
    text,
  });
}

function extractAText(xml: string): string {
  const runs = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
    decodeXml(m[1] ?? ""),
  );
  if (runs.length === 0) return "";
  // Reconstruct with paragraph breaks on </a:p>
  const withBreaks = xml
    .replace(/<\/a:p>/g, "\n")
    .replace(/<a:t[^>]*>([^<]*)<\/a:t>/g, "$1")
    .replace(/<[^>]+>/g, "");
  return decodeXml(withBreaks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || runs.join(" ").trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
