import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractDocument } from "@/lib/connectors/extraction";
import { createHash } from "node:crypto";

/**
 * Preview-style proof: authenticated handoff through POST /api/documents/process
 * must take hello.txt from QUEUED → PROCESSED within 30 seconds.
 */

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

  function updateBuilder(patch: Record<string, unknown>) {
    const api: Record<string, unknown> = {};
    const finish = () => applyUpdate(patch);
    api.eq = () => api;
    api.select = () => api;
    api.maybeSingle = async () => finish();
    api.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(finish()).then(onFulfilled, onRejected);
    return api;
  }

  return {
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

vi.mock("./company-analysis", async () => {
  const actual = await vi.importActual<typeof import("./company-analysis")>(
    "./company-analysis",
  );
  return {
    ...actual,
    runCompanyAnalysisPass: vi.fn(async (input: {
      client: {
        _store?: { doc: { status: string } };
        _statusLog?: string[];
      };
      triggerDocumentId: string;
    }) => {
      const log = input.client._statusLog;
      if (input.client._store?.doc) {
        input.client._store.doc.status = "ANALYZING";
        log?.push("ANALYZING");
        input.client._store.doc.status = "PROCESSED";
        log?.push("PROCESSED");
      }
      return {
        analyzedDocumentIds: [input.triggerDocumentId],
        deferred: false,
        processed: true,
      };
    }),
  };
});

vi.mock("@/lib/repositories/create-evidence-repository", () => ({
  createEvidenceRepository: () => ({
    upsert: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/lib/connectors/ingest", () => ({
  buildSingleConnectorCatalog: vi.fn(() => ({ connectors: [] })),
}));

const fakeClientHolder: { current: ReturnType<typeof createDocumentsClient> | null } =
  { current: null };

vi.mock("@/lib/supabase", () => ({
  createServiceClient: () => fakeClientHolder.current,
  isSupabaseConfigured: () => true,
  isServiceRoleConfigured: () => true,
}));

vi.mock("@/lib/auth/session", () => ({
  requirePrimaryCompany: vi.fn(),
  authErrorResponse: (err: unknown) => ({
    message: err instanceof Error ? err.message : String(err),
    status: 401,
  }),
}));

vi.mock("@/lib/auth/roles", () => ({
  assertCanWrite: vi.fn(),
}));

describe("hello.txt process-route handoff proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "preview-service-role";
    delete process.env.CRON_SECRET;
    delete process.env.DOCUMENT_PROCESS_SECRET;
  });

  it("extracts hello.txt", () => {
    const doc = extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(HELLO),
    });
    expect(doc.text).toContain("hello");
  });

  it("kickoff → process route → PROCESSED within 30s", async () => {
    const documentId = "05c28277-3c7a-4f6a-9429-02469d22b26d";
    const companyId = "11111111-2222-4333-8444-555555555555";
    const doc: DocRow = {
      id: documentId,
      company_id: companyId,
      connector_id: "manual-upload",
      external_id: documentId,
      title: "hello.txt",
      filename: "hello.txt",
      mime_type: "text/plain",
      storage_path: `${companyId}/${documentId}/hello.txt`,
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
      byte_size: 6,
    };

    fakeClientHolder.current = createDocumentsClient(doc);

    // Import after mocks
    const { kickoffDocumentProcessing } = await import("./kickoff");

    const secret = createHash("sha256")
      .update("company-health-document-process:preview-service-role")
      .digest("hex");
    expect(secret.length).toBe(64);

    const started = Date.now();
    const result = await kickoffDocumentProcessing({
      companyId,
      documentId,
      byteSize: 6,
      mode: "sync",
      client: fakeClientHolder.current as never,
      request: new Request("http://localhost:3000/api/documents/upload/complete", {
        headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
      }),
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(30_000);
    expect(result.accepted).toBe(true);
    expect(result.via).toBe("process-route");
    expect(result.status).toBe("PROCESSED");
    expect(fakeClientHolder.current!._store.doc.status).toBe("PROCESSED");

    const log = fakeClientHolder.current!._statusLog;
    expect(log[0]).toBe("PROCESSING");
    expect(log).toContain("EXTRACTED");
    expect(log).toContain("ANALYZING");
    expect(log.at(-1)).toBe("PROCESSED");
    expect(log).toEqual(
      expect.arrayContaining(["PROCESSING", "EXTRACTED", "ANALYZING", "PROCESSED"]),
    );
  });
});
