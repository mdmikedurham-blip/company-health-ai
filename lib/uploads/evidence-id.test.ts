import { describe, expect, it, vi } from "vitest";
import { evidenceToInsert } from "@/lib/supabase/mappers";
import { upsertCompanyEvidence } from "@/lib/supabase/repository";
import {
  canonicalizeEvidenceUuid,
  evidenceIdForManualUpload,
  isUuid,
  manualUploadExternalKey,
} from "./removal-policy";
import { extractDocument } from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import type { Evidence } from "@/lib/domain";

const PROD_DOC_UUID = "2dbe48a7-cede-41c4-81de-f2ad30b4e3ff";
const PROD_LEGACY_ID = `upload-${PROD_DOC_UUID}`;

function minimalEvidence(id: string): Evidence {
  return {
    id,
    sourceSystem: "Manual Upload",
    sourceType: "general",
    title: "hello.txt",
    contentSummary: "hello",
    extractedFacts: {},
    dimensionIds: ["dim-governance"],
    dimensionId: "dim-governance",
    dimension: "Governance",
    occurredAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    reliability: 0.5,
    metadata: {
      documentId: PROD_DOC_UUID,
      source: "manual-upload",
    },
    citation: { label: "Manual Upload · hello.txt" },
    findingIds: [],
    linkedRiskIds: [],
  };
}

describe("manual-upload evidence UUID regression", () => {
  it("strips production legacy upload- prefix to bare document UUID", () => {
    expect(canonicalizeEvidenceUuid(PROD_LEGACY_ID)).toBe(PROD_DOC_UUID);
    expect(evidenceIdForManualUpload(PROD_LEGACY_ID)).toBe(PROD_DOC_UUID);
    expect(evidenceIdForManualUpload(PROD_DOC_UUID)).toBe(PROD_DOC_UUID);
    expect(isUuid(evidenceIdForManualUpload(PROD_DOC_UUID))).toBe(true);
  });

  it("keeps prefixed identifier only as text externalKey", () => {
    expect(manualUploadExternalKey(PROD_DOC_UUID)).toBe(
      `upload:${PROD_DOC_UUID}`,
    );
    expect(manualUploadExternalKey(PROD_LEGACY_ID)).toBe(
      `upload:${PROD_DOC_UUID}`,
    );
  });

  it("evidenceToInsert never writes upload- prefixed uuid column values", () => {
    const row = evidenceToInsert("co-1", minimalEvidence(PROD_LEGACY_ID), PROD_DOC_UUID);
    expect(row.id).toBe(PROD_DOC_UUID);
    expect(row.id).not.toMatch(/^upload-/);
    expect(row.document_id).toBe(PROD_DOC_UUID);
    expect(row.metadata).toMatchObject({
      externalKey: `upload:${PROD_DOC_UUID}`,
      legacyEvidenceId: PROD_LEGACY_ID,
    });
  });

  it("upsertCompanyEvidence sends bare UUID to supabase (production failure case)", async () => {
    const upserted: unknown[] = [];
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn(async (rows: unknown[]) => {
          upserted.push(...rows);
          return { error: null };
        }),
      })),
    };

    await upsertCompanyEvidence(client as never, "co-1", [
      minimalEvidence(PROD_LEGACY_ID),
    ]);

    expect(upserted).toHaveLength(1);
    expect(upserted[0]).toMatchObject({
      id: PROD_DOC_UUID,
      document_id: PROD_DOC_UUID,
      company_id: "co-1",
    });
    expect((upserted[0] as { id: string }).id).not.toContain("upload-");
  });

  it("pipeline + manual-upload document UUID produces UUID evidence for hello.txt", async () => {
    const extracted = await extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("hello\n"),
    });
    const now = new Date().toISOString();
    const item: RawConnectorItem = {
      externalId: PROD_DOC_UUID,
      title: "hello.txt",
      syncedAt: now,
      rawSummary: extracted.text.slice(0, 500),
      path: "hello.txt",
      mimeType: "text/plain",
      metadata: { document_id: PROD_DOC_UUID, source: "manual-upload" },
    };
    const raw = rawDocumentFromConnectorItem(
      item,
      MANUAL_UPLOAD_CONNECTOR_ID,
      "Manual Upload",
    );
    const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId: evidenceIdForManualUpload(PROD_DOC_UUID),
    });
    const row = evidenceToInsert("co-1", {
      ...evidence,
      id: evidence.id,
      metadata: {
        ...evidence.metadata,
        documentId: PROD_DOC_UUID,
        externalKey: manualUploadExternalKey(PROD_DOC_UUID),
      },
    });
    expect(row.id).toBe(PROD_DOC_UUID);
    expect(isUuid(row.id)).toBe(true);
  });
});
