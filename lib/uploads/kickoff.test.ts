import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./claim", () => ({
  markDocumentFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./logging", () => ({
  logUploadProcessingEvent: vi.fn(),
}));

vi.mock("./run-process", () => ({
  acceptDocumentForProcessing: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

import { kickoffDocumentProcessing } from "./kickoff";
import { markDocumentFailed } from "./claim";
import { logUploadProcessingEvent } from "./logging";
import { acceptDocumentForProcessing } from "./run-process";

describe("kickoffDocumentProcessing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.DOCUMENT_PROCESS_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("runs in-process sync without requiring CRON_SECRET", async () => {
    vi.mocked(acceptDocumentForProcessing).mockResolvedValue({
      accepted: true,
      claimed: true,
      documentId: "doc-1",
      companyId: "co-1",
      status: "PROCESSED",
      stage: "processed",
      result: {
        documentId: "doc-1",
        companyId: "co-1",
        status: "processed",
        evidenceId: "upload-doc-1",
      },
    });

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      byteSize: 6,
      mode: "sync",
      client: {} as never,
    });

    expect(result.accepted).toBe(true);
    expect(result.via).toBe("in-process");
    expect(result.status).toBe("PROCESSED");
    expect(acceptDocumentForProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "sync", documentId: "doc-1" }),
    );
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "attempt" }),
    );
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "accepted" }),
    );
  });

  it("marks FAILED when sync worker throws", async () => {
    vi.mocked(acceptDocumentForProcessing).mockRejectedValue(
      new Error("boom"),
    );

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      mode: "sync",
      client: {} as never,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(markDocumentFailed).toHaveBeenCalled();
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_failed",
      expect.objectContaining({ stage: "kickoff" }),
    );
  });

  it("complete route awaits kickoffDocumentProcessing (contract)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const completeSrc = await fs.readFile(
      path.join(
        process.cwd(),
        "app/api/documents/upload/complete/route.ts",
      ),
      "utf8",
    );
    expect(completeSrc).toContain("await kickoffDocumentProcessing");
    expect(completeSrc).toContain('mode: "sync"');
    expect(completeSrc).not.toMatch(/\bafter\s*\(/);
  });
});
