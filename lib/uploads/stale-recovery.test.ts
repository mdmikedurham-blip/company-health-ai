import { describe, expect, it, vi } from "vitest";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { PIPELINE_HEARTBEAT_STALE_MS } from "./pipeline";

type DocRow = {
  id: string;
  status: string;
  lease_expires_at?: string | null;
  locked_at?: string | null;
  processing_started_at?: string | null;
  updated_at: string;
  last_stage?: string | null;
  pipeline_step?: string | null;
  last_successful_pipeline_step?: string | null;
  failed_step?: string | null;
  pipeline_heartbeat_at?: string | null;
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
        rows = analyzing.filter((r) => !ltCutoff || r.updated_at < ltCutoff);
      } else if (statusFilter === "EXTRACTED") {
        rows = extracted.filter((r) => !ltCutoff || r.updated_at < ltCutoff);
      }
      return Promise.resolve({ data: rows, error: null });
    };
    api.or = () => api;
    api.update = (payload: Record<string, unknown>) => {
      const chain: Record<string, unknown> = {};
      let recorded = false;
      const record = () => {
        if (recorded) return;
        recorded = true;
        const id = idFilter ?? "unknown";
        updates.push({ id, payload });
        input.onUpdate?.(payload, id);
      };
      chain.eq = (col: string, val: string) => {
        if (col === "id") idFilter = val;
        // Thenable so `await client.from().update().eq().eq()` records.
        const thenable = chain as Record<string, unknown> & PromiseLike<unknown>;
        thenable.then = (resolve: (v: unknown) => unknown) => {
          record();
          return Promise.resolve({ data: null, error: null }).then(resolve);
        };
        return chain;
      };
      chain.or = () => chain;
      chain.select = () => ({
        maybeSingle: () => {
          record();
          return Promise.resolve({
            data: { id: idFilter ?? "unknown" },
            error: null,
          });
        },
        single: () => {
          record();
          return Promise.resolve({
            data: { id: idFilter ?? "unknown" },
            error: null,
          });
        },
      });
      return chain;
    };
    return api;
  });

  return { client: { from } as never, updates };
}

describe("recoverAbandonedManualUploadJobs", () => {
  it("reclaims PROCESSING when heartbeat is older than 60s and resumes from last success", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleBeat = new Date(
      now.getTime() - PIPELINE_HEARTBEAT_STALE_MS - 1000,
    ).toISOString();
    const { client, updates } = createRecoveryClient({
      processing: [
        {
          id: "doc-stale-beat",
          status: "PROCESSING",
          lease_expires_at: "2026-07-11T12:10:00.000Z",
          locked_at: "2026-07-11T11:55:00.000Z",
          processing_started_at: "2026-07-11T11:55:00.000Z",
          updated_at: "2026-07-11T11:55:00.000Z",
          last_stage: "text_extraction",
          pipeline_step: "text_extraction",
          last_successful_pipeline_step: "storage",
          pipeline_heartbeat_at: staleBeat,
        },
        {
          id: "doc-fresh-beat",
          status: "PROCESSING",
          lease_expires_at: "2026-07-11T12:10:00.000Z",
          locked_at: "2026-07-11T11:59:00.000Z",
          processing_started_at: "2026-07-11T11:59:00.000Z",
          updated_at: "2026-07-11T11:59:00.000Z",
          last_stage: "text_extraction",
          pipeline_heartbeat_at: "2026-07-11T11:59:30.000Z",
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.requeuedProcessingIds).toEqual(["doc-stale-beat"]);
    expect(updates[0]!.payload).toMatchObject({
      pipeline_step: "text_extraction",
      metadata: expect.objectContaining({
        recovery_reason: "heartbeat_stale_60s",
        resume_step: "text_extraction",
      }),
    });
  });

  it("does not reclaim PROCESSING with a fresh heartbeat", async () => {
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
          last_stage: "text_extraction",
          pipeline_heartbeat_at: "2026-07-11T11:59:40.000Z",
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

  it("lists stale EXTRACTED docs waiting on company analysis", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleAt = new Date(
      now.getTime() - PIPELINE_HEARTBEAT_STALE_MS - 1000,
    ).toISOString();
    const { client } = createRecoveryClient({
      processing: [],
      extracted: [
        {
          id: "doc-extracted",
          status: "EXTRACTED",
          updated_at: staleAt,
          last_stage: "finding_generation",
          pipeline_step: "finding_generation",
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

  it("resets stale ANALYZING to EXTRACTED and resumes assessment step", async () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const staleAt = new Date(
      now.getTime() - PIPELINE_HEARTBEAT_STALE_MS - 1000,
    ).toISOString();
    const { client, updates } = createRecoveryClient({
      processing: [],
      analyzing: [
        {
          id: "doc-analyzing",
          status: "ANALYZING",
          updated_at: staleAt,
          last_stage: "company_assessment_update",
          pipeline_step: "company_assessment_update",
          last_successful_pipeline_step: "structured_fact_extraction",
          pipeline_heartbeat_at: staleAt,
        },
      ],
    });

    const result = await recoverAbandonedManualUploadJobs({
      client,
      companyId: "co-1",
      now,
    });

    expect(result.recoveredAnalyzingIds).toEqual(["doc-analyzing"]);
    expect(updates[0]!.payload).toMatchObject({
      status: "EXTRACTED",
      pipeline_step: "finding_generation",
      metadata: expect.objectContaining({
        recovery_reason: "analyzing_heartbeat_stale_60s",
      }),
    });
  });
});
