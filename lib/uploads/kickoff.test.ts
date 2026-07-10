import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

const { processDocumentPost } = vi.hoisted(() => ({
  processDocumentPost: vi.fn(),
}));

vi.mock("@/app/api/documents/process/route", () => ({
  POST: processDocumentPost,
}));

vi.mock("./claim", () => ({
  markDocumentFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./logging", () => ({
  logUploadProcessingEvent: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

import { kickoffDocumentProcessing } from "./kickoff";
import { markDocumentFailed } from "./claim";
import { logUploadProcessingEvent } from "./logging";
import { getDocumentProcessSecret } from "@/lib/api/process-auth";

describe("kickoffDocumentProcessing → process route handoff", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    delete process.env.CRON_SECRET;
    delete process.env.DOCUMENT_PROCESS_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("awaits authenticated POST /api/documents/process (route handler)", async () => {
    processDocumentPost.mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          claimed: true,
          status: "PROCESSED",
        }),
        { status: 200 },
      ),
    );

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      byteSize: 6,
      mode: "sync",
      client: {} as never,
      request: new Request("https://app.example.com/api/documents/upload/complete", {
        headers: { host: "app.example.com", "x-forwarded-proto": "https" },
      }),
    });

    expect(result.accepted).toBe(true);
    expect(result.via).toBe("process-route");
    expect(result.status).toBe("PROCESSED");
    expect(processDocumentPost).toHaveBeenCalledTimes(1);

    const req = processDocumentPost.mock.calls[0]![0] as Request;
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/documents/process");
    expect(req.headers.get("Authorization")).toMatch(/^Bearer /);
    const body = await req.clone().json();
    expect(body).toEqual({
      documentId: "doc-1",
      companyId: "co-1",
      mode: "sync",
    });

    const expectedSecret = createHash("sha256")
      .update("company-health-document-process:test-service-role-key")
      .digest("hex");
    expect(req.headers.get("Authorization")).toBe(`Bearer ${expectedSecret}`);
    expect(getDocumentProcessSecret()).toBe(expectedSecret);

    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "attempt" }),
    );
    expect(logUploadProcessingEvent).toHaveBeenCalledWith(
      "manual_upload_processing_kickoff",
      expect.objectContaining({ outcome: "accepted" }),
    );
  });

  it("marks FAILED when process route returns an error", async () => {
    processDocumentPost.mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      mode: "sync",
      client: {} as never,
    });

    expect(result.accepted).toBe(false);
    expect(markDocumentFailed).toHaveBeenCalled();
  });
});
