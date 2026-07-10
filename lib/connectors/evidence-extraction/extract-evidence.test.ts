import { describe, expect, it } from "vitest";
import type { ExtractedDocument } from "../extraction";
import { extractEvidence, extractEvidenceJson } from "./index";

function doc(partial: Partial<ExtractedDocument> & Pick<ExtractedDocument, "text" | "title">): ExtractedDocument {
  return {
    metadata: { format: "TXT" },
    sections: [
      {
        id: "s1",
        title: "Summary",
        text: partial.text,
        order: 1,
      },
    ],
    ...partial,
  };
}

describe("extractEvidence", () => {
  it("returns JSON-only contract fields", () => {
    const result = extractEvidence(
      doc({
        title: "Board minutes May 2026",
        text:
          "On 2026-05-22 the board approved option grants. CEO Sarah Chen noted cash runway of 9 months and $2.4M burn. Counsel flagged missing IP assignment on 3 contractor agreements.",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        evidenceType: expect.any(String),
        dimension: expect.any(String),
        confidence: expect.any(Number),
        facts: expect.any(Array),
        dates: expect.any(Array),
        amounts: expect.any(Array),
        people: expect.any(Array),
        sourceQuotes: expect.any(Array),
        recommendedFinding: expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          direction: expect.stringMatching(/positive|negative|neutral/),
          materiality: expect.any(Number),
        }),
      }),
    );

    expect(result.dates.some((d) => d.raw === "2026-05-22")).toBe(true);
    expect(result.amounts.some((a) => /2\.4/.test(a.raw))).toBe(true);
    expect(result.people.some((p) => p.name.includes("Sarah"))).toBe(true);
    expect(result.sourceQuotes.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(20);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });

  it("classifies financial runway content", () => {
    const result = extractEvidence(
      doc({
        title: "Cash forecast",
        text: "Cash runway is 6 months. Burn rate elevated versus forecast.",
      }),
    );
    expect(result.evidenceType).toBe("financial");
    expect(result.dimension).toBe("Financial");
    expect(result.recommendedFinding.direction).toMatch(/negative|neutral/);
  });

  it("extractEvidenceJson returns JSON only", () => {
    const json = extractEvidenceJson(
      doc({
        title: "Security review",
        text: "MFA coverage is 92%. Two open critical controls remain after the SOC 2 audit.",
      }),
    );
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "amounts",
        "confidence",
        "dates",
        "dimension",
        "evidenceType",
        "facts",
        "people",
        "recommendedFinding",
        "sourceQuotes",
      ].sort(),
    );
  });
});
