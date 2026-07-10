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
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    delete process.env.DOCUMENT_PROCESS_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("POSTs /api/documents/process with Bearer secret and awaits acceptance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accepted: true,
        claimed: true,
        status: "PROCESSED",
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      byteSize: 6,
      request: new Request("https://app.example.com/api/documents/upload/complete", {
        headers: {
          host: "app.example.com",
          "x-forwarded-proto": "https",
        },
      }),
    });

    expect(result.accepted).toBe(true);
    expect(result.via).toBe("http");
    expect(result.mode).toBe("sync");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://app.example.com/api/documents/process");
    expect(init.headers.Authorization).toBe("Bearer test-cron-secret");
    expect(JSON.parse(init.body)).toMatchObject({
      documentId: "doc-1",
      companyId: "co-1",
      mode: "sync",
    });
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "attempt" }),
    );
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "accepted" }),
    );
  });

  it("falls back to in-process worker when HTTP fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error("fetch failed"),
    ) as unknown as typeof fetch;

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
      client: {} as never,
    });

    expect(result.accepted).toBe(true);
    expect(result.via).toBe("in-process");
    expect(acceptDocumentForProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "sync", documentId: "doc-1" }),
    );
  });

  it("fails clearly when process secret is missing", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.DOCUMENT_PROCESS_SECRET;

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      byteSize: 6,
      client: {} as never,
    });

    expect(result.accepted).toBe(false);
    expect(markDocumentFailed).toHaveBeenCalled();
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_failed",
      expect.objectContaining({ stage: "kickoff" }),
    );
  });

  it("uses sync mode for hello.txt-sized uploads", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accepted: true, status: "PROCESSED" }),
    }) as unknown as typeof fetch;

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-hello",
      byteSize: 6,
      request: new Request("http://localhost:3000/x", {
        headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
      }),
    });

    expect(result.mode).toBe("sync");
    const body = JSON.parse(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
        .body,
    );
    expect(body.mode).toBe("sync");
  });
});
