import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractDocument } from "@/lib/connectors/extraction";

const HELLO = "hello\n";

type DocRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  connector_id: string;
  status: string;
  mime_type: string;
  storage_path: string;
  filename: string;
  title: string;
  external_id: string;
  processing_attempts: number;
};

function createDocumentsClient(initial: DocRow) {
  const store = { doc: { ...initial } };
  const statusLog: string[] = [];

  function applyUpdate(patch: Record<string, unknown>) {
    Object.assign(store.doc, patch);
    if (typeof patch.status === "string") statusLog.push(patch.status);
    return { data: { ...store.doc }, error: null };
  }

  /** Supabase query builder stub supporting .eq().eq().eq().select().maybeSingle() and await. */
  function updateBuilder(patch: Record<string, unknown>) {
    const state = { eqs: 0 };
    const api: Record<string, unknown> = {};
    const finish = () => applyUpdate(patch);

    api.eq = () => {
      state.eqs += 1;
      return api;
    };
    api.select = () => api;
    api.maybeSingle = async () => finish();
    api.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(finish()).then(onFulfilled, onRejected);

    return api;
  }

  const client = {
    rpc: async () => ({
      data: null,
      error: {
        message: "function claim_document_for_processing does not exist",
        code: "42883",
      },
    }),
    from: (table: string) => {
      if (table === "documents") {
        return {
          select: () => {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({
              data: { ...store.doc },
              error: null,
            });
            // count head path: await chain
            api.then = (
              onFulfilled: (v: unknown) => unknown,
              onRejected?: (e: unknown) => unknown,
            ) =>
              Promise.resolve({ count: 0, error: null, data: null }).then(
                onFulfilled,
                onRejected,
              );
            return api;
          },
          update: (patch: Record<string, unknown>) => updateBuilder(patch),
        };
      }
      if (table === "analysis_snapshots") {
        return { insert: async () => ({ error: null }) };
      }
      return {};
    },
    storage: {
      from: () => ({
        download: async () => ({
          data: {
            arrayBuffer: async () =>
              new TextEncoder().encode(HELLO).buffer,
          },
          error: null,
        }),
      }),
    },
    _store: store,
    _statusLog: statusLog,
  };

  return client;
}

vi.mock("@/lib/application/incremental-analysis", () => ({
  analyzeAndPersistIncremental: vi.fn(async () => ({
    recommendations: [],
    timeline: [],
    healthScore: { score: 70 },
    affected: { findingIds: [], riskIds: [], dimensionIds: [] },
  })),
}));

vi.mock("@/lib/supabase/repository", () => ({
  replaceCompanyRecommendations: vi.fn(async () => undefined),
  replaceCompanyTimeline: vi.fn(async () => undefined),
}));

vi.mock("@/lib/repositories/create-evidence-repository", () => ({
  createEvidenceRepository: () => ({
    upsert: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/lib/connectors/ingest", () => ({
  buildSingleConnectorCatalog: vi.fn(() => ({ connectors: [] })),
}));

describe("hello.txt production pipeline proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts hello.txt text", () => {
    const doc = extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(HELLO),
    });
    expect(doc.text).toContain("hello");
  });

  it("QUEUED → PROCESSING → EXTRACTED → ANALYZING → PROCESSED within 30s", async () => {
    const doc: DocRow = {
      id: "doc-hello",
      company_id: "co-1",
      connector_id: "manual-upload",
      external_id: "doc-hello",
      title: "hello.txt",
      filename: "hello.txt",
      mime_type: "text/plain",
      storage_path: "co-1/doc-hello/hello.txt",
      path: "hello.txt",
      status: "QUEUED",
      uri: "storage://x",
      modified_at: null,
      content_hash: null,
      processing_started_at: null,
      processing_completed_at: null,
      processing_attempts: 0,
      last_stage: null,
      error_message: null,
      locked_at: null,
      lease_expires_at: null,
      raw_summary: null,
      metadata: { source: "manual-upload" },
      synced_at: null,
    };

    const client = createDocumentsClient(doc);
    const { kickoffDocumentProcessing } = await import("./kickoff");

    const started = Date.now();
    const result = await kickoffDocumentProcessing({
      companyId: "co-1",
      documentId: "doc-hello",
      byteSize: 6,
      mode: "sync",
      client: client as never,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(30_000);
    expect(result.accepted).toBe(true);
    expect(result.via).toBe("in-process");
    expect(result.status).toBe("PROCESSED");
    expect(client._store.doc.status).toBe("PROCESSED");

    const log = client._statusLog;
    expect(log[0]).toBe("PROCESSING");
    expect(log).toContain("EXTRACTED");
    expect(log).toContain("ANALYZING");
    expect(log[log.length - 1]).toBe("PROCESSED");
  });
});
