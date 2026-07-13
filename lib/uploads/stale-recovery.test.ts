import { describe, expect, it, vi } from "vitest";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { STALE_ANALYZING_MS, STALE_EXTRACTED_MS } from "./constants";

type DocRow = {
  id: string;
  status: string;
  lease_expires_at?: string | null;
  locked_at?: string | null;
  processing_started_at?: string | null;
  updated_at: string;
  last_stage?: string | null;
};

/**
 * Minimal documents table mock that routes by status filter.
 */
function createRecoveryClient(input: {
  processing: DocRow[];
  analyzing?: DocRow[];
  extracted?: DocRow[];
  onUpdate?: (payload: Record<string, unknown>, id: string) => void;
}) {
  const analyzing = input.analyzing ?? [];
  const extracted = input.extracted ?? [];
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];

  const from = vi.fn(() => {
    let statusFilter: string | null = null;
    let idFilter: string | null = null;
    let ltCutoff: string | null = null;

    const api: Record<string, unknown> = {};
    api.select = () => api;
    api.eq = (col: string, val: string) => {
      if (col === "status") statusFilter = val;
      if (col === "id") idFilter = val;
      return api;
    };
    api.lt = (_col: string, val: string) => {
      ltCutoff = val;
      return api;
    };
    api.order = () => api;
    api.limit = () => {
      let rows: DocRow[] = [];
      if (statusFilter === "PROCESSING") rows = input.processing;
      else if (statusFilter === "ANALYZING") {
        rows = analyzing.filter(
          (r) => !ltCutoff || r.updated_at < ltCutoff,
        );
      } else if (statusFilter === "EXTRACTED") {
        rows = extracted.filter(
          (r) => !ltCutoff || r.updated_at < ltCutoff,
        );
      }
      return Promise.resolve({ data: rows, error: null });
    };
    api.or = () => api;
    api.update = (payload: Record<string, unknown>) => {
      const chain: Record<string, unknown> = {};
      chain.eq = (col: string, val: string) => {
        if (col === "id") idFilter = val;
        return chain;
      };
      chain.or = () => chain;
      chain.select = () => ({
        maybeSingle: () => {
          const id = idFilter ?? "unknown";
          updates.push({ id, payload });
          input.onUpdate?.(payload, id);
          return Promise.resolve({ data: { id }, error: null });
        },
      });
      return chain;
    };
    return api;
  });

  return { client: { from } as never, updates };
}

describe("recoverAbandonedManualUploadJobs", () => {
  it("requeues PROCESSING when lease has expired", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const { client, updates } = createRecoveryClient({
      processing: [
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
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual(["doc-expired"]);
    expect(result.staleExtractedIds).toEqual([]);
    expect(result.recoveredAnalyzingIds).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.payload).toMatchObject({
      status: "QUEUED",
      last_stage: "lease_expired_recovery",
      lease_expires_at: null,
      locked_at: null,
      metadata: expect.objectContaining({ recovery_reason: "lease_expired" }),
    });
  });

  it("does not requeue PROCESSING with a still-valid lease", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const { client, updates } = createRecoveryClient({
      processing: [
        {
          id: "doc-active",
          status: "PROCESSING",
          lease_expires_at: "2026-07-11T12:04:00.000Z",
          locked_at: "2026-07-11T11:59:00.000Z",
          processing_started_at: "2026-07-11T11:59:00.000Z",
          updated_at: "2026-07-11T11:59:00.000Z",
          last_stage: "extracting",
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual([]);
    expect(updates).toHaveLength(0);
  });

  it("requeues PROCESSING with missing lease after stale window", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const { client, updates } = createRecoveryClient({
      processing: [
        {
          id: "doc-orphan",
          status: "PROCESSING",
          lease_expires_at: null,
          locked_at: "2026-07-11T11:50:00.000Z",
          processing_started_at: "2026-07-11T11:50:00.000Z",
          updated_at: "2026-07-11T11:50:00.000Z",
          last_stage: "extracting",
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual(["doc-orphan"]);
    expect(updates[0]!.payload).toMatchObject({
      metadata: expect.objectContaining({
        recovery_reason: "lease_missing_or_stale",
      }),
    });
  });

  it("lists stale EXTRACTED docs for analysis recovery", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleAt = new Date(now.getTime() - STALE_EXTRACTED_MS - 1000).toISOString();
    const { client } = createRecoveryClient({
      processing: [],
      extracted: [
        {
          id: "doc-extracted",
          status: "EXTRACTED",
          updated_at: staleAt,
          last_stage: "extracted",
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual([]);
    expect(result.staleExtractedIds).toEqual(["doc-extracted"]);
  });

  it("resets stale ANALYZING docs to EXTRACTED for retry", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleAt = new Date(now.getTime() - STALE_ANALYZING_MS - 1000).toISOString();
    const { client, updates } = createRecoveryClient({
      processing: [],
      analyzing: [
        {
          id: "doc-analyzing",
          status: "ANALYZING",
          updated_at: staleAt,
          last_stage: "analyzing",
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.recoveredAnalyzingIds).toEqual(["doc-analyzing"]);
    expect(result.staleExtractedIds).toContain("doc-analyzing");
    expect(updates[0]!.payload).toMatchObject({
      status: "EXTRACTED",
      last_stage: "analyzing_stale_recovery",
    });
  });
});
