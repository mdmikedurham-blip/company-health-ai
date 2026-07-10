import { describe, expect, it, vi } from "vitest";

const afterMock = vi.fn((fn: () => void | Promise<void>) => {
  // Simulate scheduling without blocking the caller.
  void Promise.resolve().then(() => fn());
});

vi.mock("next/server", () => ({
  after: afterMock,
}));

const processManualUploadDocument = vi.fn().mockResolvedValue({
  status: "processed",
});

vi.mock("./process", () => ({
  processManualUploadDocument,
}));

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

describe("kickoffDocumentProcessing", () => {
  it("schedules processing via after() without awaiting analysis", async () => {
    const { kickoffDocumentProcessing } = await import("./kickoff");
    kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-1",
      client: {} as never,
    });

    expect(afterMock).toHaveBeenCalledTimes(1);
    // Allow microtask to run
    await Promise.resolve();
    await Promise.resolve();
    expect(processManualUploadDocument).toHaveBeenCalledWith({
      client: {},
      companyId: "co-1",
      documentId: "doc-1",
    });
  });
});
