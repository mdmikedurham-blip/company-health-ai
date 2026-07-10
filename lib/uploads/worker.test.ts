import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  claimDocumentJob,
  markDocumentFailed,
  markDocumentProcessed,
  updateDocumentStage,
  extractDocument,
  isExtractableMimeType,
  runEvidenceExtractionPipeline,
  rawDocumentFromConnectorItem,
  upsert,
  analyzeAndPersistIncremental,
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
} = vi.hoisted(() => ({
  claimDocumentJob: vi.fn(),
  markDocumentFailed: vi.fn(),
  markDocumentProcessed: vi.fn(),
  updateDocumentStage: vi.fn(),
  extractDocument: vi.fn(),
  isExtractableMimeType: vi.fn(),
  runEvidenceExtractionPipeline: vi.fn(),
  rawDocumentFromConnectorItem: vi.fn(),
  upsert: vi.fn(),
  analyzeAndPersistIncremental: vi.fn(),
  replaceCompanyRecommendations: vi.fn(),
  replaceCompanyTimeline: vi.fn(),
}));

vi.mock("./claim", () => ({
  claimDocumentJob,
  markDocumentFailed,
  markDocumentProcessed,
  updateDocumentStage,
}));

vi.mock("@/lib/connectors/extraction", () => ({
  extractDocument,
  isExtractableMimeType,
}));

vi.mock("@/lib/connectors/documents/pipeline", () => ({
  runEvidenceExtractionPipeline,
}));

vi.mock("@/lib/connectors/documents/bridges", () => ({
  rawDocumentFromConnectorItem,
}));

vi.mock("@/lib/repositories/create-evidence-repository", () => ({
  createEvidenceRepository: () => ({ upsert }),
}));

vi.mock("@/lib/application/incremental-analysis", () => ({
  analyzeAndPersistIncremental,
}));

vi.mock("@/lib/supabase/repository", () => ({
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
}));

vi.mock("@/lib/connectors/ingest", () => ({
  buildSingleConnectorCatalog: vi.fn(() => ({ connectors: [] })),
}));

import { processManualUploadDocument } from "./process";

describe("processManualUploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when claim returns null (duplicate worker)", async () => {
    claimDocumentJob.mockResolvedValue(null);
    const result = await processManualUploadDocument({
      client: {} as never,
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(result.status).toBe("skipped");
    expect(extractDocument).not.toHaveBeenCalled();
    expect(analyzeAndPersistIncremental).not.toHaveBeenCalled();
  });

  it("marks FAILED for unsupported mime and never leaves QUEUED", async () => {
    claimDocumentJob.mockResolvedValue({
      id: "doc-1",
      company_id: "co-1",
      connector_id: "manual-upload",
      external_id: "doc-1",
      title: "x.bin",
      filename: "x.bin",
      mime_type: "application/octet-stream",
      storage_path: "co-1/doc-1/x.bin",
      path: "x.bin",
      uri: null,
      modified_at: null,
      content_hash: null,
    });
    isExtractableMimeType.mockReturnValue(false);
    markDocumentFailed.mockResolvedValue(undefined);

    const result = await processManualUploadDocument({
      client: {} as never,
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(result.status).toBe("failed");
    expect(markDocumentFailed).toHaveBeenCalled();
    expect(analyzeAndPersistIncremental).not.toHaveBeenCalled();
  });

  it("invokes Insight Engine after extraction and persists snapshot", async () => {
    claimDocumentJob.mockResolvedValue({
      id: "doc-1",
      company_id: "co-1",
      connector_id: "manual-upload",
      external_id: "doc-1",
      title: "notes.txt",
      filename: "notes.txt",
      mime_type: "text/plain",
      storage_path: "co-1/doc-1/notes.txt",
      path: "notes.txt",
      uri: "storage://x",
      modified_at: null,
      content_hash: null,
    });
    isExtractableMimeType.mockReturnValue(true);
    extractDocument.mockReturnValue({
      text: "Revenue is strong",
      title: "notes.txt",
      sections: [],
      metadata: {},
    });
    rawDocumentFromConnectorItem.mockReturnValue({});
    runEvidenceExtractionPipeline.mockReturnValue({
      evidence: { id: "upload-doc-1" },
    });
    upsert.mockResolvedValue(undefined);
    updateDocumentStage.mockResolvedValue(undefined);
    analyzeAndPersistIncremental.mockResolvedValue({
      recommendations: [],
      timeline: [],
      healthScore: { score: 70 },
      affected: { findingIds: [], riskIds: [], dimensionIds: [] },
    });
    replaceCompanyRecommendations.mockResolvedValue(undefined);
    replaceCompanyTimeline.mockResolvedValue(undefined);
    markDocumentProcessed.mockResolvedValue(undefined);

    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      storage: {
        from: () => ({
          download: vi.fn().mockResolvedValue({
            data: {
              arrayBuffer: async () =>
                new TextEncoder().encode("Revenue is strong").buffer,
            },
            error: null,
          }),
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "analysis_snapshots") {
          return { insert };
        }
        return {};
      }),
    };

    const result = await processManualUploadDocument({
      client: client as never,
      companyId: "co-1",
      documentId: "doc-1",
    });

    expect(result.status).toBe("processed");
    expect(result.evidenceId).toBe("upload-doc-1");
    expect(analyzeAndPersistIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        changedEvidenceIds: ["upload-doc-1"],
        company: expect.objectContaining({ id: "co-1" }),
      }),
    );
    expect(insert).toHaveBeenCalled();
    expect(markDocumentProcessed).toHaveBeenCalled();
  });

  it("enforces tenant isolation via claim company_id match", async () => {
    claimDocumentJob.mockResolvedValue(null);
    const result = await processManualUploadDocument({
      client: {} as never,
      companyId: "other-co",
      documentId: "doc-1",
    });
    expect(result.status).toBe("skipped");
    expect(claimDocumentJob).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "other-co", documentId: "doc-1" }),
    );
  });
});
