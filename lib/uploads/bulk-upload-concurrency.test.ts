import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const {
  analyzeAndPersistIncremental,
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
} = vi.hoisted(() => ({
  analyzeAndPersistIncremental: vi.fn(),
  replaceCompanyRecommendations: vi.fn(),
  replaceCompanyTimeline: vi.fn(),
}));

vi.mock("@/lib/application/incremental-analysis", () => ({
  analyzeAndPersistIncremental,
}));

vi.mock("@/lib/supabase/repository", () => ({
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
}));

vi.mock("@/lib/connectors/ingest", () => ({
  buildSingleConnectorCatalog: vi.fn(() => ({ connectors: [] })),
}));

vi.mock("@/lib/connectors/extraction", () => ({
  isExtractableMimeType: () => true,
  extractDocument: ({
    title,
    bytes,
  }: {
    title: string;
    bytes: Uint8Array;
  }) => {
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) {
      throw new Error(
        title.toLowerCase().endsWith(".docx")
          ? "DOCX produced no extractable text"
          : "Extraction produced empty text",
      );
    }
    return { text, title, sections: [], metadata: {} };
  },
}));

vi.mock("@/lib/connectors/documents/bridges", () => ({
  rawDocumentFromConnectorItem: () => ({ title: "x" }),
}));

vi.mock("@/lib/connectors/documents/pipeline", () => ({
  runEvidenceExtractionPipeline: (
    _raw: unknown,
    _extracted: unknown,
    options?: { evidenceId?: string },
  ) => ({
    evidence: {
      id: options?.evidenceId,
      metadata: {},
      title: "x",
      contentSummary: "x",
      extractedFacts: { cashRunwayMonths: 6 },
      dimensionIds: ["dim-financial"],
      dimensionId: "dim-financial",
      dimension: "Financial",
      sourceSystem: "Manual Upload",
      sourceType: "financial",
      occurredAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      reliability: 0.8,
      citation: { label: "x" },
      findingIds: [],
      linkedRiskIds: [],
    },
  }),
}));

vi.mock("@/lib/repositories/create-evidence-repository", () => ({
  createEvidenceRepository: () => ({
    upsert: async () => undefined,
    listByCompany: async () => [],
  }),
}));

import { processManualUploadDocument } from "./process";
import { resetLocalCompanyAnalysisLocks } from "./company-analysis-lock";

const COMPANY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type DocStatus =
  | "QUEUED"
  | "PROCESSING"
  | "EXTRACTED"
  | "ANALYZING"
  | "PROCESSED"
  | "FAILED";

type DocRow = {
  id: string;
  company_id: string;
  connector_id: string;
  status: DocStatus;
  filename: string;
  title: string;
  mime_type: string;
  storage_path: string;
  external_id: string;
  path: string;
  created_at: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_attempts: number;
  last_stage: string | null;
  error_message: string | null;
  lease_expires_at: string | null;
  locked_at: string | null;
  raw_summary: string | null;
  uri: string | null;
  modified_at: string | null;
  content_hash: string | null;
};

function uuidAt(i: number): string {
  const n = (i + 1).toString(16).padStart(12, "0");
  return `bbbbbbbb-bbbb-4bbb-8bbb-${n}`;
}

const MIXED_FILES = Array.from({ length: 15 }, (_, i) => {
  const isPdf = i % 2 === 0;
  const valid = i !== 3 && i !== 11;
  return {
    id: uuidAt(i),
    filename: isPdf ? `bulk-${i + 1}.pdf` : `bulk-${i + 1}.docx`,
    mime: isPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    valid,
    body: valid
      ? `hello from file ${i + 1}\nCash runway is ${6 + (i % 5)} months.\n`
      : "",
  };
});

describe("bulk upload 15 mixed PDF/DOCX company analysis serialization", () => {
  beforeEach(() => {
    resetLocalCompanyAnalysisLocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetLocalCompanyAnalysisLocks();
  });

  it("processes all valid files to PROCESSED without timeline PK races", async () => {
    const docs = new Map<string, DocRow>();
    for (const file of MIXED_FILES) {
      docs.set(file.id, {
        id: file.id,
        company_id: COMPANY_ID,
        connector_id: "manual-upload",
        status: "QUEUED",
        filename: file.filename,
        title: file.filename,
        mime_type: file.mime,
        storage_path: `${COMPANY_ID}/${file.id}/${file.filename}`,
        external_id: file.id,
        path: file.filename,
        created_at: new Date(
          Date.now() + MIXED_FILES.indexOf(file),
        ).toISOString(),
        processing_started_at: null,
        processing_completed_at: null,
        processing_attempts: 0,
        last_stage: null,
        error_message: null,
        lease_expires_at: null,
        locked_at: null,
        raw_summary: null,
        uri: `storage://${file.id}`,
        modified_at: null,
        content_hash: null,
      });
    }

    let timelineRows: Array<{ id: string }> = [];
    let concurrentAnalysis = 0;
    let maxConcurrentAnalysis = 0;
    let analysisCalls = 0;
    let timelineReplaceConflicts = 0;
    const bodies = new Map(MIXED_FILES.map((f) => [f.id, f.body]));

    function filterDocs(status?: string) {
      return [...docs.values()].filter((d) =>
        status ? d.status === status : true,
      );
    }

    analyzeAndPersistIncremental.mockImplementation(async () => {
      concurrentAnalysis += 1;
      maxConcurrentAnalysis = Math.max(maxConcurrentAnalysis, concurrentAnalysis);
      analysisCalls += 1;
      await new Promise((r) => setTimeout(r, 15));
      concurrentAnalysis -= 1;
      return {
        recommendations: [
          {
            id: "rec-extend-runway",
            title: "Extend runway",
            description: "x",
            dimensionId: "dim-financial",
            dimension: "Financial",
            riskIds: [],
            evidenceIds: [],
            findingIds: [],
            priority: "high",
            effort: "medium",
            confidence: 80,
            estimatedScoreImprovement: 5,
            rationale: "x",
            nextSteps: [],
            priorityScore: 1,
          },
        ],
        timeline: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            companyId: COMPANY_ID,
            type: "evidence-created",
            title: "Evidence",
            summary: "x",
            description: "x",
            occurredAt: new Date().toISOString(),
            date: "Jul 11, 2026",
            month: "July 2026",
            evidenceIds: [],
            findingIds: [],
            riskIds: [],
            rootEventId: "11111111-1111-4111-8111-111111111111",
            causalChainId: "chain-1",
            confidence: 80,
            metadata: { eventKey: "tl-evidence-created-shared" },
          },
        ],
        healthScore: {
          score: 70,
          status: "watch",
          change: 0,
          changeLabel: "",
          lastUpdated: "",
          confidence: 80,
        },
        findings: [],
        risks: [],
        dimensions: [],
        affected: { findingIds: [], riskIds: [], dimensionIds: [] },
      };
    });

    replaceCompanyRecommendations.mockResolvedValue(undefined);
    replaceCompanyTimeline.mockImplementation(async (_c, _co, events) => {
      const rows = events.map((e: { id: string }) => ({ id: e.id }));
      const ids = new Set(timelineRows.map((r) => r.id));
      for (const row of rows) {
        if (ids.has(row.id)) {
          timelineReplaceConflicts += 1;
          throw new Error(
            'replaceCompanyTimeline.insert: duplicate key value violates unique constraint "timeline_events_pkey"',
          );
        }
        ids.add(row.id);
      }
      // Simulate wipe-replace under lock.
      timelineRows = rows;
    });

    const client = {
      rpc: async (fn: string) => {
        if (
          fn === "claim_document_for_processing" ||
          fn === "try_lock_company_analysis" ||
          fn === "unlock_company_analysis"
        ) {
          return {
            data: null,
            error: { message: `function ${fn} missing`, code: "42883" },
          };
        }
        return { data: null, error: { message: `unknown rpc ${fn}` } };
      },
      storage: {
        from: () => ({
          download: async (path: string) => {
            const docId = path.split("/")[1]!;
            const text = bodies.get(docId) ?? "";
            return {
              data: {
                arrayBuffer: async () =>
                  new TextEncoder().encode(text).buffer,
              },
              error: null,
            };
          },
        }),
      },
      from: (table: string) => {
        if (table === "documents") {
          return {
            select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
              const api: Record<string, unknown> = {};
              let statusFilter: string | null = null;
              let idFilter: string | null = null;
              api.eq = (col: string, val: string) => {
                if (col === "status") statusFilter = val;
                if (col === "id") idFilter = val;
                return api;
              };
              api.order = () => api;
              api.limit = () => api;
              api.or = () => api;
              api.maybeSingle = async () => {
                if (idFilter) {
                  return { data: docs.get(idFilter) ?? null, error: null };
                }
                return { data: null, error: null };
              };
              api.then = (
                onFulfilled: (v: unknown) => unknown,
                onRejected?: (e: unknown) => unknown,
              ) => {
                if (opts?.head && opts?.count === "exact") {
                  return Promise.resolve({
                    count: filterDocs("PROCESSED").length,
                    error: null,
                    data: null,
                  }).then(onFulfilled, onRejected);
                }
                const list = idFilter
                  ? [docs.get(idFilter)].filter(Boolean)
                  : filterDocs(statusFilter ?? undefined);
                return Promise.resolve({
                  data: list.map((d) => ({ id: d!.id })),
                  error: null,
                }).then(onFulfilled, onRejected);
              };
              return api;
            },
            update: (patch: Record<string, unknown>) => {
              const api: Record<string, unknown> = {};
              let id: string | null = null;
              let statusEq: string | null = null;
              api.eq = (col: string, val: string) => {
                if (col === "id") id = val;
                if (col === "status") statusEq = val;
                return api;
              };
              api.select = () => api;
              api.maybeSingle = async () => {
                if (!id) return { data: null, error: null };
                const doc = docs.get(id);
                if (!doc) return { data: null, error: null };
                if (statusEq && doc.status !== statusEq) {
                  return { data: null, error: null };
                }
                Object.assign(doc, patch);
                return { data: { ...doc }, error: null };
              };
              api.then = (
                onFulfilled: (v: unknown) => unknown,
                onRejected?: (e: unknown) => unknown,
              ) =>
                Promise.resolve(api.maybeSingle()).then(
                  onFulfilled,
                  onRejected,
                );
              return api;
            },
          };
        }
        if (table === "analysis_snapshots") {
          return { insert: async () => ({ error: null }) };
        }
        return {};
      },
    };

    const results = await Promise.all(
      MIXED_FILES.map((file) =>
        processManualUploadDocument({
          client: client as never,
          companyId: COMPANY_ID,
          documentId: file.id,
        }),
      ),
    );

    const validIds = new Set(MIXED_FILES.filter((f) => f.valid).map((f) => f.id));
    const invalidIds = new Set(
      MIXED_FILES.filter((f) => !f.valid).map((f) => f.id),
    );

    for (const id of validIds) {
      expect(docs.get(id)?.status, `valid ${id}`).toBe("PROCESSED");
      expect(docs.get(id)?.error_message, id).toBeNull();
    }
    for (const id of invalidIds) {
      expect(docs.get(id)?.status, `invalid ${id}`).toBe("FAILED");
      expect(docs.get(id)?.error_message ?? "").toMatch(
        /no extractable text|empty text/i,
      );
    }

    expect(results.filter((r) => r.status === "processed")).toHaveLength(
      validIds.size,
    );
    expect(results.filter((r) => r.status === "failed")).toHaveLength(
      invalidIds.size,
    );

    expect(maxConcurrentAnalysis).toBe(1);
    expect(analysisCalls).toBeGreaterThanOrEqual(1);
    expect(timelineReplaceConflicts).toBe(0);
    expect(timelineRows.length).toBeGreaterThan(0);
  });
});
