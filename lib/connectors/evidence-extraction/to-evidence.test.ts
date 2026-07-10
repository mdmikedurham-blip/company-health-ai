import { describe, expect, it } from "vitest";
import type { RawConnectorItem } from "../connector";
import type { EvidenceExtractionResult } from "./types";
import { evidenceFromExtraction } from "./to-evidence";

const extraction: EvidenceExtractionResult = {
  evidenceType: "financial",
  dimension: "Financial",
  confidence: 82,
  facts: ["Cash runway is 6 months"],
  dates: [{ raw: "2026-05-22", iso: "2026-05-22", context: "as of 2026-05-22" }],
  amounts: [
    {
      raw: "$2.4M",
      value: 2_400_000,
      currency: "USD",
      context: "burn $2.4M",
    },
  ],
  people: [{ name: "Sarah Chen", role: "CEO", context: "CEO Sarah Chen" }],
  sourceQuotes: [
    {
      text: "Cash runway is 6 months with elevated burn versus forecast.",
      sectionId: "s1",
      sectionTitle: "Summary",
    },
  ],
  recommendedFinding: {
    title: "Potential risk signal: Cash forecast",
    description: "Financial financial evidence from Cash forecast.",
    direction: "negative",
    materiality: 70,
  },
};

const item: RawConnectorItem = {
  externalId: "file-cash",
  title: "Cash forecast",
  syncedAt: "2026-07-09T12:00:00.000Z",
  rawSummary: "Cash runway is 6 months. Burn rate elevated versus forecast.",
  path: "finance/Cash forecast",
  mimeType: "application/pdf",
  metadata: {
    uri: "https://drive.google.com/file/d/file-cash",
    sourceSystem: "Google Drive",
    evidenceId: "gdrive-file-cash",
  },
};

describe("evidenceFromExtraction", () => {
  it("maps extraction JSON into domain Evidence for the store", () => {
    const evidence = evidenceFromExtraction(item, extraction);
    expect(evidence.id).toBe("gdrive-file-cash");
    expect(evidence.sourceSystem).toBe("Google Drive");
    expect(evidence.sourceType).toBe("financial");
    expect(evidence.dimensionId).toBe("dim-financial");
    expect(evidence.dimension).toBe("Financial");
    expect(evidence.reliability).toBe(82);
    expect(evidence.occurredAt).toBe("2026-05-22");
    expect(evidence.extractedFacts.cashRunwayMonths).toBe(6);
    expect(evidence.extractedFacts.recommendedFindingDirection).toBe("negative");
    expect(evidence.citation.uri).toBe(
      "https://drive.google.com/file/d/file-cash",
    );
  });
});
