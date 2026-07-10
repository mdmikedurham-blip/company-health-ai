import { describe, expect, it, vi } from "vitest";
import {
  claimDocumentJob,
  requeueDocumentJobs,
  isTerminalUploadStatus,
} from "./claim";
import { computeDashboardProcessingState } from "./progress";
import { progressLabelForStatus } from "./constants";

function mockClient(handlers: {
  rpc?: ReturnType<typeof vi.fn>;
  from?: ReturnType<typeof vi.fn>;
}) {
  return {
    rpc: handlers.rpc ?? vi.fn(),
    from: handlers.from ?? vi.fn(),
  } as never;
}

describe("claimDocumentJob", () => {
  it("returns claimed row from RPC", async () => {
    const row = {
      id: "doc-1",
      company_id: "co-1",
      status: "PROCESSING",
      processing_attempts: 1,
    };
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const claimed = await claimDocumentJob({
      client: mockClient({ rpc }),
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(claimed).toEqual(row);
    expect(rpc).toHaveBeenCalledWith("claim_document_for_processing", {
      p_document_id: "doc-1",
      p_company_id: "co-1",
      p_lease_seconds: 300,
    });
  });

  it("returns null when another worker already claimed", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const claimed = await claimDocumentJob({
      client: mockClient({ rpc }),
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(claimed).toBeNull();
  });

  it("falls back to conditional update when RPC missing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function claim_document_for_processing does not exist", code: "42883" },
    });

    const maybeSingleLoad = vi.fn().mockResolvedValue({
      data: {
        id: "doc-1",
        company_id: "co-1",
        status: "QUEUED",
        processing_attempts: 0,
        processing_started_at: null,
        lease_expires_at: null,
        locked_at: null,
      },
      error: null,
    });
    const maybeSingleUpdate = vi.fn().mockResolvedValue({
      data: {
        id: "doc-1",
        company_id: "co-1",
        status: "PROCESSING",
        processing_attempts: 1,
      },
      error: null,
    });

    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: maybeSingleLoad,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: maybeSingleUpdate,
              }),
            }),
          }),
        }),
      }),
    });

    const claimed = await claimDocumentJob({
      client: mockClient({ rpc, from }),
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(claimed?.status).toBe("PROCESSING");
    expect(claimed?.processing_attempts).toBe(1);
  });
});

describe("requeueDocumentJobs", () => {
  it("requeues FAILED and QUEUED older than 60s; ignores fresh QUEUED/PROCESSING", async () => {
    const now = Date.now();
    const rows = [
      {
        id: "failed-1",
        status: "FAILED",
        lease_expires_at: null,
        locked_at: null,
        processing_started_at: null,
        updated_at: new Date(now).toISOString(),
      },
      {
        id: "queued-fresh",
        status: "QUEUED",
        lease_expires_at: null,
        locked_at: null,
        processing_started_at: null,
        updated_at: new Date(now).toISOString(),
      },
      {
        id: "queued-stale",
        status: "QUEUED",
        lease_expires_at: null,
        locked_at: null,
        processing_started_at: null,
        updated_at: new Date(now - 61_000).toISOString(),
      },
      {
        id: "fresh-1",
        status: "PROCESSING",
        lease_expires_at: new Date(now + 60_000).toISOString(),
        locked_at: new Date(now).toISOString(),
        processing_started_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
    ];

    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
      update,
    });

    const ids = await requeueDocumentJobs({
      client: mockClient({ from }),
      companyId: "co-1",
    });
    expect(ids).toEqual(["failed-1", "queued-stale"]);
  });

  it("requeues stale PROCESSING after lease expiry", async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const rows = [
      {
        id: "stale-1",
        status: "PROCESSING",
        lease_expires_at: stale,
        locked_at: stale,
        processing_started_at: stale,
        updated_at: stale,
      },
    ];

    const inFn = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ in: inFn }),
      }),
    });

    const ids = await requeueDocumentJobs({
      client: mockClient({ from }),
      companyId: "co-1",
    });
    expect(ids).toEqual(["stale-1"]);
  });
});

describe("dashboard progress states", () => {
  it("maps statuses to progress labels", () => {
    expect(progressLabelForStatus("UPLOADED")).toBe("Uploading");
    expect(progressLabelForStatus("QUEUED")).toBe("Queued");
    expect(progressLabelForStatus("PROCESSING")).toBe("Extracting");
    expect(progressLabelForStatus("EXTRACTED")).toBe("Extracting");
    expect(progressLabelForStatus("ANALYZING")).toBe("Analyzing");
    expect(progressLabelForStatus("PROCESSED")).toBe("Complete");
    expect(progressLabelForStatus("FAILED")).toBe("Failed");
  });

  it("is ready when snapshot exists", () => {
    const state = computeDashboardProcessingState({
      hasAnalysisSnapshot: true,
      uploads: [
        {
          id: "1",
          filename: "a.txt",
          title: "a.txt",
          status: "ANALYZING",
          updated_at: new Date().toISOString(),
        },
      ],
    });
    expect(state.analysisReady).toBe(true);
  });

  it("is ready when all uploads are terminal without snapshot", () => {
    const state = computeDashboardProcessingState({
      hasAnalysisSnapshot: false,
      uploads: [
        {
          id: "1",
          filename: "a.txt",
          title: "a.txt",
          status: "FAILED",
          updated_at: new Date().toISOString(),
          error_message: "boom",
        },
        {
          id: "2",
          filename: "b.txt",
          title: "b.txt",
          status: "PROCESSED",
          updated_at: new Date().toISOString(),
        },
      ],
    });
    expect(state.allTerminal).toBe(true);
    expect(state.analysisReady).toBe(true);
    expect(state.inFlight).toBe(false);
  });

  it("marks stalled after 5 minutes without progress", () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const state = computeDashboardProcessingState({
      hasAnalysisSnapshot: false,
      uploads: [
        {
          id: "1",
          filename: "a.txt",
          title: "a.txt",
          status: "QUEUED",
          updated_at: old,
          processing_started_at: null,
        },
      ],
    });
    expect(state.stalled).toBe(true);
  });

  it("terminal FAILED is a terminal status", () => {
    expect(isTerminalUploadStatus("FAILED")).toBe(true);
    expect(isTerminalUploadStatus("QUEUED")).toBe(false);
  });
});

describe("immediate kickoff contract", () => {
  it("complete awaits authenticated process-route kickoff", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const kickoffSrc = await fs.readFile(
      path.join(process.cwd(), "lib/uploads/kickoff.ts"),
      "utf8",
    );
    const completeSrc = await fs.readFile(
      path.join(
        process.cwd(),
        "app/api/documents/upload/complete/route.ts",
      ),
      "utf8",
    );
    expect(kickoffSrc).toContain("processDocumentPost");
    expect(kickoffSrc).toContain("/api/documents/process");
    expect(kickoffSrc).toContain("Authorization");
    expect(kickoffSrc).toContain("manual_upload_processing_kickoff");
    expect(completeSrc).toContain("await kickoffDocumentProcessing");
    expect(completeSrc).toContain('mode: "sync"');
    expect(completeSrc).not.toMatch(/\bafter\s*\(/);
  });
});
