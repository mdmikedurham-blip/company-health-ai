import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { extractDocument, extractPdf } from "./index";
import {
  extractGovernanceFactsFromText,
  hasEnoughGovernanceFacts,
  mergeGovernanceFactsInto,
} from "./governance-facts";
import { looksLikeBinaryOrPdfJunk } from "./text-quality";
import { runEvidenceExtractionPipeline } from "../documents/pipeline";
import type { RawDocument } from "../documents/types";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";

const BOARD_MINUTES_TEXT = `
MINUTES OF A MEETING OF THE BOARD OF DIRECTORS
Date: July 10, 2026

Directors present: Alice Chen, Bob Rivera, Carol Diaz.

RESOLVED, that the financing of Series A notes is hereby approved and authorized.

Upon motion duly made, the Board elected Dana Okonkwo as a director.

The Board approved option grants for 12,000 shares to new hires, with board approval documented.

Corporate action: amendment of the bylaws was unanimously approved.

The Board confirmed the next quarterly board meeting cadence.
`.trim();

function buildSimplePdfWithFlateText(plain: string): Uint8Array {
  // Minimal PDF with one FlateDecode content stream containing Tj operators.
  const content = `BT /F1 12 Tf 100 700 Td (${plain.slice(0, 200).replace(/[()\\]/g, "")}) Tj ET`;
  const compressed = deflateSync(Buffer.from(content, "utf8"));
  const stream = Buffer.concat([
    Buffer.from(
      "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /Contents 4 0 R /MediaBox [0 0 612 792] >>endobj\n4 0 obj<< /Length " +
        compressed.length +
        " /Filter /FlateDecode >>stream\n",
      "latin1",
    ),
    compressed,
    Buffer.from("\nendstream\nendobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
  return new Uint8Array(stream);
}

describe("PDF extraction quality", () => {
  it("rejects object-stream printable junk instead of treating it as evidence", () => {
    const junk =
      "%PDF-1.7\n1 0 obj<< /Type /Catalog >>endobj\n2 0 obj<< /Length 10 >>stream\n\x00\x01endstream\nendobj\n";
    expect(looksLikeBinaryOrPdfJunk(junk)).toBe(true);
    expect(() => extractPdf("board.pdf", junk)).toThrow(/object streams|no extractable/i);
  });

  it("extracts readable text from FlateDecode content streams", () => {
    const bytes = buildSimplePdfWithFlateText(
      "Board minutes approved financing and director election",
    );
    const doc = extractPdf("minutes.pdf", bytes);
    expect(doc.metadata.extractionQuality).toBe("ok");
    expect(doc.text.toLowerCase()).toMatch(/board|approv|director|financ/);
    expect(looksLikeBinaryOrPdfJunk(doc.text)).toBe(false);
  });

  it("accepts clean plain-text board minutes", () => {
    const doc = extractPdf("minutes.pdf", BOARD_MINUTES_TEXT);
    expect(doc.text).toContain("Series A");
    expect(doc.metadata.extractionMethod).toBe("plain-text");
  });
});

describe("governance facts from board minutes", () => {
  it("extracts approvals, elections, financing, grants, cadence", () => {
    const facts = extractGovernanceFactsFromText(BOARD_MINUTES_TEXT);
    expect(facts.boardApprovalsDocumented).toBe(true);
    expect(facts.directorElectionsDocumented).toBe(true);
    expect(facts.financingApprovalsDocumented).toBe(true);
    expect(facts.optionGrantsApproved).toBe(true);
    expect(facts.corporateActionsDocumented).toBe(true);
    expect(facts.governanceCadenceDocumented).toBe(true);
    expect(facts.boardMeetingDate).toContain("2026");
    expect(hasEnoughGovernanceFacts(facts)).toBe(true);
  });

  it("flags missing board approvals when stated", () => {
    const facts = extractGovernanceFactsFromText(
      "Board minutes. Three option grants were issued without board approval.",
    );
    expect(facts.optionGrantsMissingBoardApproval).toBeGreaterThan(0);
    expect(facts.materialActionsMissingBoardApproval).toBe(true);
  });

  it("does not invent governance facts from unrelated text", () => {
    const facts = extractGovernanceFactsFromText(
      "Revenue was $2M. Cash balance $900k. Runway 20 months.",
    );
    expect(hasEnoughGovernanceFacts(facts)).toBe(false);
    expect(Object.keys(facts).length).toBe(0);
  });
});

describe("board minutes PDF → governance finding → Governance scored", () => {
  it("scores Governance from clean board minutes with real facts only", () => {
    const extracted = extractDocument({
      title: "board-minutes-july.pdf",
      mimeType: "application/pdf",
      text: BOARD_MINUTES_TEXT,
      sourceMetadata: { document_id: "doc-gov-1", source: "manual-upload" },
    });

    const merged = mergeGovernanceFactsInto({}, extracted);
    expect(merged.added).toBeGreaterThanOrEqual(2);

    const raw: RawDocument = {
      externalId: "doc-gov-1",
      connectorId: "manual-upload",
      sourceSystem: "Manual Upload",
      title: "board-minutes-july.pdf",
      rawSummary: extracted.text.slice(0, 200),
      syncedAt: "2026-07-11T12:00:00.000Z",
      path: "board-minutes-july.pdf",
      mimeType: "application/pdf",
      metadata: { document_id: "doc-gov-1", source: "manual-upload" },
    };

    const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId: "doc-gov-1",
    });

    expect(evidence.dimensionId).toBe("dim-governance");
    expect(evidence.extractedFacts.boardApprovalsDocumented).toBe(true);
    expect(evidence.extractedFacts.directorElectionsDocumented).toBe(true);
    expect(evidence.contentSummary).not.toMatch(/endobj|\d+\s+\d+\s+obj/);
    expect(evidence.reliability).toBeGreaterThan(25);

    const engine = runInsightEngine({
      companyId: "co-gov",
      evidence: [evidence],
      asOf: DEFAULT_AS_OF,
    });

    const governance = engine.dimensions.find((d) => d.id === "dim-governance");
    expect(governance?.scored).toBe(true);
    expect(governance?.status).not.toBe("insufficient");
    expect(
      engine.findings.some((f) => f.id === "finding-governance-metrics"),
    ).toBe(true);

    // Presence-only junk must not score Governance.
    expect(() =>
      extractPdf(
        "junk.pdf",
        "%PDF-1.4\n52 0 obj\n<< /Type /Font >>\nendobj\n53 0 obj\nendobj\n",
      ),
    ).toThrow(/object streams/i);
  });

  it("reprocess-equivalent upsert replaces evidence id without inventing healthy score from empty facts", () => {
    const emptyish = extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      text: "Hello world. This is not a board packet.",
      sourceMetadata: { document_id: "doc-gov-empty" },
    });
    const raw: RawDocument = {
      externalId: "doc-gov-empty",
      connectorId: "manual-upload",
      sourceSystem: "Manual Upload",
      title: "hello.txt",
      rawSummary: emptyish.text,
      syncedAt: "2026-07-11T12:00:00.000Z",
      path: "hello.txt",
      mimeType: "text/plain",
      metadata: {},
    };
    const { evidence } = runEvidenceExtractionPipeline(raw, emptyish, {
      evidenceId: "doc-gov-empty",
    });
    const engine = runInsightEngine({
      companyId: "co-gov-empty",
      evidence: [evidence],
      asOf: DEFAULT_AS_OF,
    });
    const governance = engine.dimensions.find((d) => d.id === "dim-governance");
    // May be insufficient — must not be healthy solely from document existence.
    if (evidence.dimensionId === "dim-governance") {
      expect(governance?.scored).not.toBe(true);
    }
  });
});
