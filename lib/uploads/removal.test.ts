import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/repository", () => ({
  deleteEvidenceByIds: vi.fn().mockResolvedValue(undefined),
  deleteFindingsByIds: vi.fn().mockResolvedValue(undefined),
  deleteRisksByIds: vi.fn().mockResolvedValue(undefined),
  listFindings: vi.fn().mockResolvedValue([]),
  listRisks: vi.fn().mockResolvedValue([]),
  upsertCompanyFindings: vi.fn().mockResolvedValue(undefined),
  upsertCompanyRisks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./company-analysis", () => ({
  rebuildCompanyIntelligenceUnderLock: vi.fn().mockResolvedValue({
    rebuilt: true,
    deferred: false,
  }),
}));

vi.mock("./stale-recovery", () => ({
  recoverAbandonedManualUploadJobs: vi.fn().mockResolvedValue({
    requeuedProcessingIds: [],
    staleExtractedIds: [],
  }),
}));

import {
  deleteEvidenceByIds,
  deleteFindingsByIds,
  deleteRisksByIds,
  listFindings,
  listRisks,
} from "@/lib/supabase/repository";
import { rebuildCompanyIntelligenceUnderLock } from "./company-analysis";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import {
  canRemoveDocument,
  canRetryQueuedDocument,
  isActivelyProcessing,
  isRemovalBlocked,
  removeConfirmMessage,
  REMOVE_CONFIRM_PROCESSED,
  REMOVE_CONFIRM_UNPROCESSED,
  visibleManualUploadActions,
} from "./removal-policy";
import { removeManualUploadDocument } from "./removal";
import { cancelManualUploadProcessing } from "./cancel";

const deleteEvidenceByIdsMock = vi.mocked(deleteEvidenceByIds);
const deleteFindingsByIdsMock = vi.mocked(deleteFindingsByIds);
const deleteRisksByIdsMock = vi.mocked(deleteRisksByIds);
const listFindingsMock = vi.mocked(listFindings);
const listRisksMock = vi.mocked(listRisks);
const rebuildMock = vi.mocked(rebuildCompanyIntelligenceUnderLock);
const recoverMock = vi.mocked(recoverAbandonedManualUploadJobs);

type DocRow = {
  id: string;
  company_id: string;
  connector_id: string;
  status: string;
  storage_path: string | null;
  lease_expires_at?: string | null;
  locked_at?: string | null;
  processing_started_at?: string | null;
  updated_at?: string | null;
  last_stage?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

function createRemovalClient(opts: {
  docs: Map<string, DocRow>;
  evidence?: { id: string; document_id: string | null }[];
  storageRemove?: ReturnType<typeof vi.fn>;
  storageList?: ReturnType<typeof vi.fn>;
  deleteError?: { message: string } | null;
}) {
  const storageRemove =
    opts.storageRemove ?? vi.fn().mockResolvedValue({ error: null });
  const storageList =
    opts.storageList ?? vi.fn().mockResolvedValue({ data: [], error: null });
  const evidence = opts.evidence ?? [];

  function matchDoc(filters: Record<string, string>): DocRow | null {
    const doc = opts.docs.get(filters.id);
    if (!doc) return null;
    if (filters.company_id && doc.company_id !== filters.company_id) return null;
    if (filters.connector_id && doc.connector_id !== filters.connector_id) {
      return null;
    }
    return doc;
  }

  function documentsTable() {
    return {
      select() {
        const filters: Record<string, string> = {};
        const chain = {
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          async maybeSingle() {
            return { data: matchDoc(filters), error: null };
          },
        };
        return chain;
      },
      delete() {
        const filters: Record<string, string> = {};
        const chain = {
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          then(
            resolve: (v: { error: { message: string } | null }) => void,
            reject?: (e: unknown) => void,
          ) {
            return Promise.resolve()
              .then(() => {
                if (opts.deleteError) {
                  return { error: opts.deleteError };
                }
                const doc = matchDoc(filters);
                if (doc) opts.docs.delete(doc.id);
                return { error: null };
              })
              .then(resolve, reject);
          },
        };
        return chain;
      },
      update(payload: Record<string, unknown>) {
        const filters: Record<string, string> = {};
        const chain: Record<string, unknown> = {};
        chain.eq = (col: string, val: string) => {
          filters[col] = val;
          return chain;
        };
        chain.in = () => chain;
        chain.select = () => chain;
        chain.maybeSingle = async () => {
          const doc = matchDoc(filters);
          if (!doc) return { data: null, error: null };
          if (filters.status && doc.status !== filters.status) {
            return { data: null, error: null };
          }
          Object.assign(doc, payload);
          return { data: { ...doc }, error: null };
        };
        chain.then = (
          resolve: (v: { error: null }) => void,
          reject?: (e: unknown) => void,
        ) =>
          Promise.resolve()
            .then(async () => {
              await (chain.maybeSingle as () => Promise<unknown>)();
              return { error: null };
            })
            .then(resolve, reject);
        return chain;
      },
    };
  }

  function evidenceTable() {
    return {
      select() {
        const filters: Record<string, string> = {};
        let inIds: string[] | null = null;
        const chain = {
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          in(_col: string, ids: string[]) {
            inIds = ids;
            return chain;
          },
          then(
            resolve: (v: {
              data: { id: string }[];
              error: null;
            }) => void,
            reject?: (e: unknown) => void,
          ) {
            return Promise.resolve()
              .then(() => {
                let rows = evidence.filter((e) => {
                  if (
                    filters.company_id &&
                    filters.company_id !== "co-1" &&
                    filters.company_id !== "co-other"
                  ) {
                    return false;
                  }
                  if (
                    filters.document_id &&
                    e.document_id !== filters.document_id
                  ) {
                    return false;
                  }
                  return true;
                });
                if (inIds) {
                  rows = rows.filter((e) => inIds!.includes(e.id));
                }
                return { data: rows.map((r) => ({ id: r.id })), error: null };
              })
              .then(resolve, reject);
          },
        };
        return chain;
      },
    };
  }

  return {
    from(table: string) {
      if (table === "documents") return documentsTable();
      if (table === "evidence") return evidenceTable();
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: vi.fn().mockReturnValue({
        remove: storageRemove,
        list: storageList,
      }),
    },
  } as never;
}

describe("removal-policy", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("allows remove for UPLOADED, QUEUED, EXTRACTED, FAILED, PROCESSED", () => {
    expect(canRemoveDocument({ status: "UPLOADED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "QUEUED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "EXTRACTED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "FAILED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "PROCESSED" }, now)).toBe(true);
  });

  it("blocks remove for active PROCESSING and ANALYZING", () => {
    expect(
      canRemoveDocument(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      canRemoveDocument(
        {
          status: "ANALYZING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isRemovalBlocked(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      isActivelyProcessing(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("allows remove for stale PROCESSING with expired lease", () => {
    expect(
      canRemoveDocument(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T11:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("shows Retry|Remove for queued >60s and Failed", () => {
    expect(
      visibleManualUploadActions(
        {
          status: "QUEUED",
          updated_at: "2026-07-10T11:58:00.000Z",
        },
        now,
      ),
    ).toEqual(["retry", "remove"]);
    expect(visibleManualUploadActions({ status: "FAILED" }, now)).toEqual([
      "retry",
      "remove",
    ]);
  });

  it("shows Remove (not Cancel) for fresh EXTRACTED", () => {
    expect(
      isActivelyProcessing(
        {
          status: "EXTRACTED",
          lease_expires_at: null,
          updated_at: "2026-07-10T11:59:50.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      visibleManualUploadActions(
        {
          status: "EXTRACTED",
          lease_expires_at: null,
          updated_at: "2026-07-10T11:59:50.000Z",
        },
        now,
      ),
    ).toEqual(["remove"]);
  });

  it("shows Cancel only for active processing", () => {
    expect(
      visibleManualUploadActions(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toEqual(["cancel"]);
  });

  it("does not show Retry for fresh QUEUED", () => {
    expect(
      canRetryQueuedDocument(
        {
          status: "QUEUED",
          updated_at: "2026-07-10T11:59:30.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      visibleManualUploadActions(
        {
          status: "QUEUED",
          updated_at: "2026-07-10T11:59:30.000Z",
        },
        now,
      ),
    ).toEqual(["remove"]);
  });

  it("shows Remove for PROCESSED and uses rebuilt confirm copy", () => {
    expect(visibleManualUploadActions({ status: "PROCESSED" }, now)).toEqual([
      "remove",
    ]);
    expect(removeConfirmMessage("PROCESSED")).toBe(REMOVE_CONFIRM_PROCESSED);
    expect(removeConfirmMessage("QUEUED")).toBe(REMOVE_CONFIRM_UNPROCESSED);
  });
});

describe("removeManualUploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFindingsMock.mockResolvedValue([]);
    listRisksMock.mockResolvedValue([]);
    rebuildMock.mockResolvedValue({ rebuilt: true, deferred: false });
    recoverMock.mockResolvedValue({
      requeuedProcessingIds: [],
      staleExtractedIds: [],
    });
  });

  it("enforces tenant isolation — other company gets 403", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-1",
        {
          id: "doc-1",
          company_id: "co-other",
          connector_id: "manual-upload",
          status: "QUEUED",
          storage_path: "co-other/doc-1/a.txt",
        },
      ],
    ]);
    const client = createRemovalClient({ docs });
    await expect(
      removeManualUploadDocument({
        client,
        companyId: "co-1",
        documentId: "doc-1",
      }),
    ).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
    });
    expect(docs.has("doc-1")).toBe(true);
  });

  it("returns alreadyGone for missing document (idempotent)", async () => {
    const docs = new Map<string, DocRow>();
    const client = createRemovalClient({ docs });
    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "missing",
    });
    expect(result.alreadyGone).toBe(true);
    expect(result.removed).toBe(true);
  });

  it("removes a queued file and storage object", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-q",
        {
          id: "doc-q",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "QUEUED",
          storage_path: "co-1/doc-q/a.txt",
        },
      ],
    ]);
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    const client = createRemovalClient({ docs, storageRemove });

    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-q",
    });

    expect(result.removed).toBe(true);
    expect(result.storageDeleted).toBe(true);
    expect(result.dbDeleted).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["co-1/doc-q/a.txt"]);
    expect(docs.has("doc-q")).toBe(false);
  });

  it("removes a failed file", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-f",
        {
          id: "doc-f",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "FAILED",
          storage_path: "co-1/doc-f/a.txt",
        },
      ],
    ]);
    const client = createRemovalClient({ docs });
    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-f",
    });
    expect(result.removed).toBe(true);
    expect(docs.has("doc-f")).toBe(false);
  });

  it("cleans up sole-dependent findings and risks", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-e",
        {
          id: "doc-e",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "FAILED",
          storage_path: "co-1/doc-e/a.txt",
        },
      ],
    ]);
    const evidenceId = "doc-e";
    listFindingsMock.mockResolvedValue([
      { id: "f-sole", evidenceIds: [evidenceId] } as never,
      { id: "f-shared", evidenceIds: [evidenceId, "other-ev"] } as never,
    ]);
    listRisksMock.mockResolvedValue([
      {
        id: "r-sole",
        evidenceIds: [evidenceId],
        findingIds: ["f-sole"],
      } as never,
    ]);

    const client = createRemovalClient({
      docs,
      evidence: [{ id: evidenceId, document_id: "doc-e" }],
    });

    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-e",
    });

    expect(result.removed).toBe(true);
    expect(result.findingsDeleted).toContain("f-sole");
    expect(result.findingsDeleted).not.toContain("f-shared");
    expect(result.risksDeleted).toContain("r-sole");
    expect(deleteEvidenceByIdsMock).toHaveBeenCalledWith(
      expect.anything(),
      "co-1",
      expect.arrayContaining([evidenceId]),
    );
    expect(deleteFindingsByIdsMock).toHaveBeenCalled();
    expect(deleteRisksByIdsMock).toHaveBeenCalled();
  });

  it("removes an EXTRACTED file without rebuild", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-x",
        {
          id: "doc-x",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "EXTRACTED",
          storage_path: "co-1/doc-x/a.txt",
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        },
      ],
    ]);
    const client = createRemovalClient({
      docs,
      evidence: [{ id: "doc-x", document_id: "doc-x" }],
    });
    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-x",
    });
    expect(result.removed).toBe(true);
    expect(rebuildMock).not.toHaveBeenCalled();
    expect(docs.has("doc-x")).toBe(false);
  });

  it("recovers stale PROCESSING lease before removal", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-stale",
        {
          id: "doc-stale",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "PROCESSING",
          storage_path: "co-1/doc-stale/a.txt",
          lease_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    ]);
    recoverMock.mockImplementation(async () => {
      const row = docs.get("doc-stale");
      if (row) {
        row.status = "QUEUED";
        row.lease_expires_at = null;
        row.locked_at = null;
      }
      return {
        requeuedProcessingIds: ["doc-stale"],
        staleExtractedIds: [],
      };
    });
    const client = createRemovalClient({ docs });
    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-stale",
    });
    expect(recoverMock).toHaveBeenCalled();
    expect(result.removed).toBe(true);
    expect(docs.has("doc-stale")).toBe(false);
  });

  it("protects actively processing documents", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-p",
        {
          id: "doc-p",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "PROCESSING",
          storage_path: "co-1/doc-p/a.txt",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    ]);
    const client = createRemovalClient({ docs });
    await expect(
      removeManualUploadDocument({
        client,
        companyId: "co-1",
        documentId: "doc-p",
      }),
    ).rejects.toMatchObject({
      message: "Processing in progress",
      status: 409,
    });
    expect(docs.has("doc-p")).toBe(true);
  });

  it("removes PROCESSED docs and rebuilds company analysis under lock", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-done",
        {
          id: "doc-done",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "PROCESSED",
          storage_path: "co-1/doc-done/a.pdf",
        },
      ],
    ]);
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    const client = createRemovalClient({
      docs,
      storageRemove,
      evidence: [{ id: "doc-done", document_id: "doc-done" }],
    });

    const callOrder: string[] = [];
    deleteEvidenceByIdsMock.mockImplementation(async () => {
      callOrder.push("evidence");
    });
    rebuildMock.mockImplementation(async () => {
      callOrder.push("rebuild");
      return { rebuilt: true, deferred: false };
    });

    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-done",
    });

    expect(result.removed).toBe(true);
    expect(result.rebuiltAnalysis).toBe(true);
    expect(callOrder).toEqual(["evidence", "rebuild"]);
    expect(rebuildMock).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "co-1" }),
    );
    expect(storageRemove).toHaveBeenCalledWith(["co-1/doc-done/a.pdf"]);
    expect(docs.has("doc-done")).toBe(false);
  });

  it("keeps DELETING row and surfaces recoverable error when rebuild fails", async () => {
    rebuildMock.mockResolvedValueOnce({
      rebuilt: false,
      deferred: false,
      errorMessage: "timeline insert failed",
    });
    const docs = new Map<string, DocRow>([
      [
        "doc-rb",
        {
          id: "doc-rb",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "PROCESSED",
          storage_path: "co-1/doc-rb/a.pdf",
        },
      ],
    ]);
    const client = createRemovalClient({ docs });

    await expect(
      removeManualUploadDocument({
        client,
        companyId: "co-1",
        documentId: "doc-rb",
      }),
    ).rejects.toMatchObject({
      message: "timeline insert failed",
      status: 409,
      rebuildFailed: true,
    });

    expect(docs.has("doc-rb")).toBe(true);
    expect(docs.get("doc-rb")?.status).toBe("DELETING");
    expect(docs.get("doc-rb")?.last_stage).toBe("removal_rebuild_failed");
  });

  it("is idempotent for repeated delete requests", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-i",
        {
          id: "doc-i",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "QUEUED",
          storage_path: "co-1/doc-i/a.txt",
        },
      ],
    ]);
    const client = createRemovalClient({ docs });
    const first = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-i",
    });
    expect(first.removed).toBe(true);

    const second = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-i",
    });
    expect(second.removed).toBe(true);
    expect(second.alreadyGone).toBe(true);
  });

  it("records orphaned_storage_path when storage delete fails", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-o",
        {
          id: "doc-o",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "QUEUED",
          storage_path: "co-1/doc-o/a.txt",
        },
      ],
    ]);
    const storageRemove = vi
      .fn()
      .mockResolvedValue({ error: { message: "storage down" } });
    const storageList = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = createRemovalClient({ docs, storageRemove, storageList });

    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-o",
    });

    expect(result.removed).toBe(false);
    expect(result.orphanedStoragePath).toBe("co-1/doc-o/a.txt");
    expect(docs.has("doc-o")).toBe(true);
  });

  it("records cleanup_required when DB delete fails after storage success", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-c",
        {
          id: "doc-c",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "QUEUED",
          storage_path: "co-1/doc-c/a.txt",
        },
      ],
    ]);
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    const client = createRemovalClient({
      docs,
      storageRemove,
      deleteError: { message: "db delete failed" },
    });

    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-c",
    });

    expect(result.removed).toBe(false);
    expect(result.cleanupRequired).toBe(true);
    expect(result.storageDeleted).toBe(true);
    expect(result.dbDeleted).toBe(false);
  });
});

describe("cancelManualUploadProcessing", () => {
  it("cancels active PROCESSING", async () => {
    const docs = new Map<string, DocRow>([
      [
        "doc-x",
        {
          id: "doc-x",
          company_id: "co-1",
          connector_id: "manual-upload",
          status: "PROCESSING",
          storage_path: "co-1/doc-x/a.txt",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    ]);
    const client = createRemovalClient({ docs });
    const result = await cancelManualUploadProcessing({
      client,
      companyId: "co-1",
      documentId: "doc-x",
    });
    expect(result.cancelled).toBe(true);
    expect(result.status).toBe("FAILED");
    expect(docs.get("doc-x")?.status).toBe("FAILED");
  });
});
