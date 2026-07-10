import { describe, expect, it } from "vitest";
import {
  extractCsv,
  extractDocument,
  extractGoogleDocs,
  extractGoogleSheets,
  extractGoogleSlides,
  extractMarkdown,
  extractPdf,
  extractTxt,
} from "./index";

describe("ExtractedDocument extractors", () => {
  it("TXT → ExtractedDocument with text, title, metadata, sections", () => {
    const doc = extractTxt("notes.txt", "Hello\n\nWorld");
    expect(doc).toMatchObject({
      title: "notes.txt",
      text: "Hello\n\nWorld",
    });
    expect(doc.metadata.format).toBe("TXT");
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    expect(doc.sections[0]).toHaveProperty("text");
    expect(doc.sections[0]).toHaveProperty("order");
  });

  it("Markdown sections on headings", () => {
    const doc = extractMarkdown(
      "brief.md",
      "# Risk\nCash low\n\n## Next\nRaise round",
    );
    expect(doc.metadata.format).toBe("Markdown");
    expect(doc.sections.map((s) => s.title)).toEqual(["Risk", "Next"]);
    expect(doc.text).toContain("Cash low");
  });

  it("CSV rows become sections", () => {
    const doc = extractCsv(
      "customers.csv",
      "name,arr\nAcme,100\nBeta,50",
    );
    expect(doc.metadata.format).toBe("CSV");
    expect(doc.metadata.rowCount).toBe(2);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]?.title).toBe("Acme");
  });

  it("PDF uses printable text sections", () => {
    const doc = extractPdf("board.pdf", "Page one.\n\nPage two.");
    expect(doc.metadata.format).toBe("PDF");
    expect(doc.sections.length).toBe(2);
    expect(doc.title).toBe("board.pdf");
  });

  it("Google Docs / Sheets / Slides produce ExtractedDocument", () => {
    const docs = extractGoogleDocs(
      "Strategy",
      "# Overview\nPlan A\n\n# Risks\nRunway",
    );
    expect(docs.metadata.format).toBe("Google Docs");
    expect(docs.sections.length).toBeGreaterThanOrEqual(2);

    const sheets = extractGoogleSheets(
      "Pipeline",
      "deal,stage\nA,won\nB,open",
    );
    expect(sheets.metadata.format).toBe("Google Sheets");
    expect(sheets.sections).toHaveLength(2);

    const slides = extractGoogleSlides(
      "Board deck",
      "Slide 1\nTitle\n\nSlide 2\nMetrics",
    );
    expect(slides.metadata.format).toBe("Google Slides");
    expect(slides.sections.length).toBeGreaterThanOrEqual(2);
  });

  it("extractDocument routes by mime type", () => {
    const doc = extractDocument({
      title: "a.md",
      mimeType: "text/markdown",
      text: "# Hi\nThere",
      sourceMetadata: { fileId: "f1" },
    });
    expect(doc.title).toBe("a.md");
    expect(doc.metadata.fileId).toBe("f1");
    expect(doc.metadata.format).toBe("Markdown");
    expect(doc.sections[0]?.title).toBe("Hi");
  });

  it("rejects unsupported mime types", () => {
    expect(() =>
      extractDocument({
        title: "x",
        mimeType: "image/png",
        text: "",
      }),
    ).toThrow(/Unsupported mime type/);
  });
});
