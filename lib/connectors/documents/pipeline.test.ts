import { describe, expect, it } from "vitest";
import type { ExtractedDocument } from "../extraction/types";
import type { RawDocument } from "./types";
import {
  evidenceFromCandidate,
  runEvidenceExtractionPipeline,
  toEvidenceCandidate,
} from "./pipeline";
import { extractEvidence } from "../evidence-extraction/extract-evidence";

const raw: RawDocument = {
  externalId: "file-cash",
  connectorId: "google-drive",
  sourceSystem: "Google Drive",
  title: "Cash forecast",
  path: "finance/Cash forecast",
  modifiedAt: "2026-05-22T00:00:00.000Z",
  mimeType: "application/pdf",
  contentHash: "md5:abc",
  uri: "https://drive.google.com/file/d/file-cash",
  rawSummary: "Cash runway is 6 months with elevated burn versus forecast.",
  syncedAt: "2026-07-09T12:00:00.000Z",
  metadata: {},
};

const extracted: ExtractedDocument = {
  title: "Cash forecast",
  text: "Cash runway is 6 months with elevated burn versus forecast. As of 2026-05-22.",
  metadata: { fileId: "file-cash", format: "pdf" },
  sections: [
    {
      id: "s1",
      title: "Summary",
      text: "Cash runway is 6 months with elevated burn versus forecast.",
      order: 0,
    },
  ],
};

describe("evidence extraction pipeline", () => {
  it("produces EvidenceCandidate then domain Evidence without mock data", () => {
    const { candidate, evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId: "gdrive-file-cash",
    });

    expect(candidate.proposedId).toBe("gdrive-file-cash");
    expect(candidate.sourceSystem).toBe("Google Drive");
    expect(candidate.rawDocument.externalId).toBe("file-cash");
    expect(candidate.facts.cashRunwayMonths).toBe(6);

    expect(evidence.id).toBe("gdrive-file-cash");
    expect(evidence.dimensionId).toBe("dim-financial");
    expect(evidence.extractedFacts.cashRunwayMonths).toBe(6);
    expect(evidence.findingIds).toEqual([]);
    expect(evidence.linkedRiskIds).toEqual([]);
  });

  it("evidenceFromCandidate preserves candidate facts", () => {
    const extraction = extractEvidence(extracted);
    const candidate = toEvidenceCandidate(raw, extracted, extraction);
    const evidence = evidenceFromCandidate(candidate);
    expect(evidence.sourceType).toBe(candidate.sourceType);
    expect(evidence.reliability).toBe(candidate.confidence);
  });
});
