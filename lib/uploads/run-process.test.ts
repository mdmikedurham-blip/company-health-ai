import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  claimDocumentJob,
  processManualUploadDocument,
  continueClaimedManualUpload,
  waitUntil,
} = vi.hoisted(() => ({
  claimDocumentJob: vi.fn(),
  processManualUploadDocument: vi.fn(),
  continueClaimedManualUpload: vi.fn(),
  waitUntil: vi.fn((p: Promise<unknown>) => {
    void p;
  }),
}));

vi.mock("@vercel/functions", () => ({ waitUntil }));

vi.mock("./claim", () => ({
  claimDocumentJob,
}));

vi.mock("./process", () => ({
  processManualUploadDocument,
  continueClaimedManualUpload,
}));

vi.mock("./logging", () => ({
  logUploadProcessingEvent: vi.fn(),
}));

import { acceptDocumentForProcessing } from "./run-process";
import { logUploadProcessingEvent } from "./logging";

describe("acceptDocumentForProcessing hello.txt sync path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mode=sync claims and awaits PROCESSED for a tiny text upload", async () => {
    processManualUploadDocument.mockResolvedValue({
      documentId: "doc-hello",
      companyId: "co-1",
      status: "processed",
      evidenceId: "upload-doc-hello",
    });

    const started = Date.now();
    const result = await acceptDocumentForProcessing({
      client: {} as never,
      companyId: "co-1",
      documentId: "doc-hello",
      mode: "sync",
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(30_000);
    expect(result.accepted).toBe(true);
    expect(result.status).toBe("PROCESSED");
    expect(result.result?.status).toBe("processed");
    expect(processManualUploadDocument).toHaveBeenCalledWith({
      client: {},
      companyId: "co-1",
      documentId: "doc-hello",
    });
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_started",
      expect.objectContaining({ documentId: "doc-hello" }),
    );
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_completed",
      expect.objectContaining({ status: "PROCESSED" }),
    );
  });

  it("mode=accept claims then schedules continuation via waitUntil", async () => {
    claimDocumentJob.mockResolvedValue({
      id: "doc-1",
      company_id: "co-1",
      connector_id: "manual-upload",
    });
    continueClaimedManualUpload.mockResolvedValue({
      documentId: "doc-1",
      companyId: "co-1",
      status: "processed",
    });

    const result = await acceptDocumentForProcessing({
      client: {} as never,
      companyId: "co-1",
      documentId: "doc-1",
      mode: "accept",
    });

    expect(result.status).toBe("PROCESSING");
    expect(result.claimed).toBe(true);
    expect(waitUntil).toHaveBeenCalled();
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_started",
      expect.objectContaining({ status: "PROCESSING" }),
    );
  });
});
