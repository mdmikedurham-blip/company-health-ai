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
  advancePipelineStep,
  failPipelineStep,
  heartbeatPipelineStep,
  resumePipelineStep,
  shouldSkipPipelineStep,
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
  advancePipelineStep: vi.fn(),
  failPipelineStep: vi.fn(),
  heartbeatPipelineStep: vi.fn(),
  resumePipelineStep: vi.fn(() => "text_extraction"),
  shouldSkipPipelineStep: vi.fn(() => false),
}));

vi.mock("./claim", () => ({
  claimDocumentJob,
  markDocumentFailed,
  markDocumentProcessed,
  updateDocumentStage,
}));

vi.mock("./pipeline", async () => {
  const actual = await vi.importActual<typeof import("./pipeline")>("./pipeline");
  return {
    ...actual,
    advancePipelineStep,
    failPipelineStep,
    heartbeatPipelineStep,
    resumePipelineStep,
    shouldSkipPipelineStep,
  };
});

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

vi.mock("./company-analysis", () => ({
  runCompanyAnalysisPass: vi.fn(async () => ({
    analyzedDocumentIds: ["11111111-1111-4111-8111-111111111111"],
    deferred: false,
    processed: true,
  })),
  mapWithConcurrency: async <T, R>(
    items: T[],
    _concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ) => Promise.all(items.map((item, index) => worker(item, index))),
}));

import { processManualUploadDocument } from "./process";
import { runCompanyAnalysisPass } from "./company-analysis";

describe("processManualUploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resumePipelineStep.mockReturnValue("text_extraction");
    shouldSkipPipelineStep.mockReturnValue(false);
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
    failPipelineStep.mockResolvedValue({
      category: "extraction",
      retryable: true,
    });

    const result = await processManualUploadDocument({
      client: {} as never,
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(result.status).toBe("failed");
    expect(failPipelineStep).toHaveBeenCalled();
    expect(analyzeAndPersistIncremental).not.toHaveBeenCalled();
  });

  it("invokes Insight Engine after extraction and persists snapshot", async () => {
    claimDocumentJob.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "co-1",
      connector_id: "manual-upload",
      external_id: "11111111-1111-4111-8111-111111111111",
      title: "notes.txt",
      filename: "notes.txt",
      mime_type: "text/plain",
      storage_path: "co-1/11111111-1111-4111-8111-111111111111/notes.txt",
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
      evidence: { id: "11111111-1111-4111-8111-111111111111" },
    });
    upsert.mockResolvedValue(undefined);
    updateDocumentStage.mockResolvedValue(undefined);
    advancePipelineStep.mockResolvedValue(undefined);
    heartbeatPipelineStep.mockResolvedValue(undefined);

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
      from: vi.fn(() => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: "PROCESSING" },
            error: null,
          }),
        };
        return chain;
      }),
    };

    const result = await processManualUploadDocument({
      client: client as never,
      companyId: "co-1",
      documentId: "doc-1",
    });

    expect(result.status).toBe("processed");
    expect(result.evidenceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(upsert).toHaveBeenCalledWith(
      "co-1",
      expect.arrayContaining([
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
          metadata: expect.objectContaining({
            documentId: "11111111-1111-4111-8111-111111111111",
            externalKey: "upload:11111111-1111-4111-8111-111111111111",
            source: "manual-upload",
          }),
        }),
      ]),
    );
    expect(advancePipelineStep).toHaveBeenCalledWith(
      expect.objectContaining({
        step: "finding_generation",
        status: "EXTRACTED",
      }),
    );
    expect(runCompanyAnalysisPass).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co-1",
        triggerDocumentId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(analyzeAndPersistIncremental).not.toHaveBeenCalled();
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
