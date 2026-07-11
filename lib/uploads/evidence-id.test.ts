import { describe, expect, it } from "vitest";
import { extractDocument } from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import {
  evidenceIdForManualUpload,
  manualUploadExternalKey,
} from "./removal-policy";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("manual upload evidence UUID", () => {
  const documentId = "05c28277-3c7a-4f6a-9429-02469d22b26d";

  it("uses document.id as evidence id without upload- prefix", () => {
    expect(evidenceIdForManualUpload(documentId)).toBe(documentId);
    expect(evidenceIdForManualUpload(documentId)).not.toMatch(/^upload-/);
    expect(evidenceIdForManualUpload(documentId)).toMatch(UUID_RE);
  });

  it("stores the synthetic upload key as text metadata only", () => {
    expect(manualUploadExternalKey(documentId)).toBe(`upload:${documentId}`);
  });

  it("builds evidence for hello.txt with a UUID evidence id", () => {
    const hello = "hello\n";
    const extracted = extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(hello),
    });
    expect(extracted.text).toContain("hello");

    const now = new Date().toISOString();
    const item: RawConnectorItem = {
      externalId: documentId,
      title: "hello.txt",
      syncedAt: now,
      rawSummary: extracted.text.slice(0, 500),
      path: "hello.txt",
      mimeType: "text/plain",
      metadata: {
        document_id: documentId,
        source: "manual-upload",
      },
    };
    const raw = rawDocumentFromConnectorItem(
      item,
      MANUAL_UPLOAD_CONNECTOR_ID,
      "Manual Upload",
    );
    const evidenceId = evidenceIdForManualUpload(documentId);
    const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId,
    });

    expect(evidence.id).toBe(documentId);
    expect(evidence.id).toMatch(UUID_RE);
    expect(evidence.id).not.toContain("upload-");
  });

  it("defaultEvidenceId for manual-upload uses externalId UUID", () => {
    const now = new Date().toISOString();
    const item: RawConnectorItem = {
      externalId: documentId,
      title: "hello.txt",
      syncedAt: now,
      rawSummary: "hello",
      path: "hello.txt",
      mimeType: "text/plain",
    };
    const raw = rawDocumentFromConnectorItem(
      item,
      MANUAL_UPLOAD_CONNECTOR_ID,
      "Manual Upload",
    );
    const { evidence } = runEvidenceExtractionPipeline(
      raw,
      extractDocument({
        title: "hello.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("hello\n"),
      }),
    );
    expect(evidence.id).toBe(documentId);
    expect(evidence.id).toMatch(UUID_RE);
  });
});
