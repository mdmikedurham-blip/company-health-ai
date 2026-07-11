import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canRemoveDocument,
  canRetryQueuedDocument,
  isActivelyProcessing,
  visibleManualUploadActions,
} from "./removal-policy";
import { removeManualUploadDocument } from "./removal";
import { cancelManualUploadProcessing } from "./cancel";

vi.mock("@/lib/supabase/repository", () => ({
  deleteEvidenceByIds: vi.fn().mockResolvedValue(undefined),
  deleteFindingsByIds: vi.fn().mockResolvedValue(undefined),
  deleteRisksByIds: vi.fn().mockResolvedValue(undefined),
  listFindings: vi.fn().mockResolvedValue([]),
  listRisks: vi.fn().mockResolvedValue([]),
  upsertCompanyFindings: vi.fn().mockResolvedValue(undefined),
  upsertCompanyRisks: vi.fn().mockResolvedValue(undefined),
}));

import {
  deleteEvidenceByIds,
  deleteFindingsByIds,
  deleteRisksByIds,
  listFindings,
  listRisks,
} from "@/lib/supabase/repository";

const deleteEvidenceByIdsMock = vi.mocked(deleteEvidenceByIds);
const deleteFindingsByIdsMock = vi.mocked(deleteFindingsByIds);
const deleteRisksByIdsMock = vi.mocked(deleteRisksByIds);
const listFindingsMock = vi.mocked(listFindings);
const listRisksMock = vi.mocked(listRisks);

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
        const chain = {
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          in() {
            return chain;
          },
          then(
            resolve: (v: { error: null }) => void,
            reject?: (e: unknown) => void,
          ) {
            return Promise.resolve()
              .then(() => {
                const doc = matchDoc(filters);
                if (doc) Object.assign(doc, payload);
                return { error: null };
              })
              .then(resolve, reject);
          },
        };
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

  it("allows remove for UPLOADED, QUEUED, FAILED", () => {
    expect(canRemoveDocument({ status: "UPLOADED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "QUEUED" }, now)).toBe(true);
    expect(canRemoveDocument({ status: "FAILED" }, now)).toBe(true);
  });

  it("blocks remove for active PROCESSING and PROCESSED", () => {
    expect(
      canRemoveDocument(
        {
          status: "PROCESSING",
          lease_expires_at: "2026-07-10T12:05:00.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(canRemoveDocument({ status: "PROCESSED" }, now)).toBe(false);
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

  it("hides remove for PROCESSED", () => {
    expect(visibleManualUploadActions({ status: "PROCESSED" }, now)).toEqual(
      [],
    );
  });
});

describe("removeManualUploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFindingsMock.mockResolvedValue([]);
    listRisksMock.mockResolvedValue([]);
  });

  it("enforces tenant isolation — other company cannot see/remove", async () => {
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
    const result = await removeManualUploadDocument({
      client,
      companyId: "co-1",
      documentId: "doc-1",
    });
    expect(result.alreadyGone).toBe(true);
    expect(result.removed).toBe(true);
    expect(docs.has("doc-1")).toBe(true);
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
      message: expect.stringContaining("actively processing"),
      status: 409,
    });
    expect(docs.has("doc-p")).toBe(true);
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
