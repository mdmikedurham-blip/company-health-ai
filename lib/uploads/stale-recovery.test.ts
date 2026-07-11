import { describe, expect, it, vi } from "vitest";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { STALE_EXTRACTED_MS } from "./constants";

function processingQuery(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

function extractedQuery(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            lt: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("recoverAbandonedManualUploadJobs", () => {
  it("requeues PROCESSING when lease has expired", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const processingRows = [
      {
        id: "doc-expired",
        status: "PROCESSING",
        lease_expires_at: "2026-07-11T11:50:00.000Z",
        locked_at: "2026-07-11T11:45:00.000Z",
        processing_started_at: "2026-07-11T11:45:00.000Z",
        updated_at: "2026-07-11T11:45:00.000Z",
        last_stage: "extracting",
      },
      {
        id: "doc-active",
        status: "PROCESSING",
        lease_expires_at: "2026-07-11T12:04:00.000Z",
        locked_at: "2026-07-11T11:59:00.000Z",
        processing_started_at: "2026-07-11T11:59:00.000Z",
        updated_at: "2026-07-11T11:59:00.000Z",
        last_stage: "extracting",
      },
    ];

    const updateCalls: unknown[] = [];
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) return processingQuery(processingRows);
      if (call === 2) {
        return {
          update: (payload: unknown) => {
            updateCalls.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    or: () => ({
                      select: () => ({
                        maybeSingle: () =>
                          Promise.resolve({
                            data: { id: "doc-expired" },
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }
      return extractedQuery([]);
    });

    const result = await recoverAbandonedManualUploadJobs({
      client: { from } as never,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual(["doc-expired"]);
    expect(result.staleExtractedIds).toEqual([]);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      status: "QUEUED",
      last_stage: "lease_expired_recovery",
      lease_expires_at: null,
      locked_at: null,
      metadata: expect.objectContaining({ recovery_reason: "lease_expired" }),
    });
  });

  it("does not requeue PROCESSING with a still-valid lease", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const processingRows = [
      {
        id: "doc-active",
        status: "PROCESSING",
        lease_expires_at: "2026-07-11T12:04:00.000Z",
        locked_at: "2026-07-11T11:59:00.000Z",
        processing_started_at: "2026-07-11T11:59:00.000Z",
        updated_at: "2026-07-11T11:59:00.000Z",
        last_stage: "extracting",
      },
    ];

    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) return processingQuery(processingRows);
      return extractedQuery([]);
    });

    const result = await recoverAbandonedManualUploadJobs({
      client: { from } as never,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual([]);
    expect(call).toBe(2);
  });

  it("requeues PROCESSING with missing lease after stale window", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const processingRows = [
      {
        id: "doc-orphan",
        status: "PROCESSING",
        lease_expires_at: null,
        locked_at: "2026-07-11T11:50:00.000Z",
        processing_started_at: "2026-07-11T11:50:00.000Z",
        updated_at: "2026-07-11T11:50:00.000Z",
        last_stage: "extracting",
      },
    ];

    const updateCalls: unknown[] = [];
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) return processingQuery(processingRows);
      if (call === 2) {
        return {
          update: (payload: unknown) => {
            updateCalls.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    or: () => ({
                      select: () => ({
                        maybeSingle: () =>
                          Promise.resolve({
                            data: { id: "doc-orphan" },
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }
      return extractedQuery([]);
    });

    const result = await recoverAbandonedManualUploadJobs({
      client: { from } as never,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual(["doc-orphan"]);
    expect(updateCalls[0]).toMatchObject({
      metadata: expect.objectContaining({
        recovery_reason: "lease_missing_or_stale",
      }),
    });
  });

  it("returns stale EXTRACTED ids for analysis retry", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleUpdated = new Date(
      now.getTime() - STALE_EXTRACTED_MS - 1_000,
    ).toISOString();

    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) return processingQuery([]);
      return extractedQuery([
        {
          id: "doc-extracted",
          updated_at: staleUpdated,
          last_stage: "extracted",
        },
      ]);
    });

    const result = await recoverAbandonedManualUploadJobs({
      client: { from } as never,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual([]);
    expect(result.staleExtractedIds).toEqual(["doc-extracted"]);
  });
});
