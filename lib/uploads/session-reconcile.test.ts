import { describe, expect, it } from "vitest";
import {
  buildSessionDisplayRows,
  clearStaleUploadSessionStorage,
  pruneSessionEntries,
  sessionStatusesMatchDocuments,
  shouldPollDocumentIds,
  shouldSkipReprocess,
} from "./session-reconcile";

describe("session upload — single authoritative status", () => {
  it("derives This session status from the same documents list as Recent", () => {
    const documents = [
      { id: "doc-a", status: "PROCESSED", filename: "Board Package.xlsx" },
      { id: "doc-b", status: "PROCESSED", filename: "Cap Table.xlsx" },
    ];
    const session = [
      {
        localId: "local-1",
        documentId: "doc-a",
        filename: "Board Package.xlsx",
        byteSize: 10,
        phase: "done" as const,
        progress: 100,
      },
      {
        localId: "local-2",
        documentId: "doc-b",
        filename: "Cap Table.xlsx",
        byteSize: 10,
        phase: "done" as const,
        progress: 100,
      },
    ];

    const rows = buildSessionDisplayRows(session, documents);
    expect(rows.every((r) => r.status === "PROCESSED")).toBe(true);
    expect(rows.every((r) => r.labelSource === "authoritative")).toBe(true);
    expect(sessionStatusesMatchDocuments({
      sessionDocumentIds: ["doc-a", "doc-b"],
      documents,
    }).ok).toBe(true);
  });

  it("regression: upload → backend CURRENT → both sections show CURRENT without refresh", () => {
    // Immediately after upload complete, kickoff may still say EXTRACTED locally,
    // but the authoritative list (same API Recent uses) already has PROCESSED.
    const session = [
      {
        localId: "u1",
        documentId: "doc-1",
        filename: "Customer Revenue Report.xlsx",
        byteSize: 100,
        phase: "done" as const,
        progress: 100,
      },
    ];
    const documentsAfterAnalysis = [
      { id: "doc-1", status: "PROCESSED", filename: "Customer Revenue Report.xlsx" },
    ];

    const sessionRow = buildSessionDisplayRows(session, documentsAfterAnalysis)[0]!;
    const recentRow = documentsAfterAnalysis[0]!;

    expect(sessionRow.status).toBe("PROCESSED");
    expect(recentRow.status).toBe("PROCESSED");
    expect(sessionRow.status).toBe(recentRow.status);
  });

  it("auto-clears session entries once analysis is terminal", () => {
    const pruned = pruneSessionEntries(
      [
        {
          localId: "done",
          documentId: "doc-1",
          filename: "a.xlsx",
          byteSize: 1,
          phase: "done",
          progress: 100,
        },
        {
          localId: "inflight",
          documentId: "doc-2",
          filename: "b.xlsx",
          byteSize: 1,
          phase: "done",
          progress: 100,
        },
        {
          localId: "uploading",
          documentId: null,
          filename: "c.xlsx",
          byteSize: 1,
          phase: "uploading",
          progress: 40,
        },
      ],
      [
        { id: "doc-1", status: "PROCESSED" },
        { id: "doc-2", status: "ANALYZING" },
      ],
    );
    expect(pruned.map((e) => e.localId)).toEqual(["inflight", "uploading"]);
  });

  it("drops session entries whose documentId was deleted", () => {
    const pruned = pruneSessionEntries(
      [
        {
          localId: "gone",
          documentId: "doc-x",
          filename: "x.xlsx",
          byteSize: 1,
          phase: "done",
          progress: 100,
        },
      ],
      [],
    );
    expect(pruned).toHaveLength(0);
  });

  it("polls by document_id until authoritative status leaves in-flight", () => {
    expect(
      shouldPollDocumentIds({
        sessionDocumentIds: ["doc-1"],
        documents: [{ id: "doc-1", status: "ANALYZING" }],
      }),
    ).toBe(true);
    expect(
      shouldPollDocumentIds({
        sessionDocumentIds: ["doc-1"],
        documents: [{ id: "doc-1", status: "PROCESSED" }],
      }),
    ).toBe(false);
  });

  it("clears legacy session storage keys on page load", () => {
    const store = new Map<string, string>();
    const storage = {
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    storage.setItem("upload-session", "stale");
    storage.setItem("cha-upload-session", "stale");
    clearStaleUploadSessionStorage(storage);
    expect(store.size).toBe(0);
  });

  it("skips duplicate reprocess while in-flight", () => {
    expect(shouldSkipReprocess("ANALYZING")).toBe(true);
    expect(shouldSkipReprocess("PROCESSED")).toBe(false);
  });
});
