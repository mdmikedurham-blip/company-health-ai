import { describe, expect, it } from "vitest";
import {
  SESSION_POLL_TIMEOUT_MESSAGE,
  applySessionPollTimeouts,
  reconcileSessionItems,
  shouldPollUploadLists,
  shouldSkipReprocess,
} from "./session-reconcile";

describe("session upload reconciliation", () => {
  it("updates session status from authoritative documentId, never filename", () => {
    const items = [
      {
        localId: "local-1",
        documentId: "doc-a",
        phase: "done",
        status: "ANALYZING",
        inFlightSinceMs: 1000,
      },
      {
        localId: "local-2",
        documentId: "doc-b",
        phase: "done",
        status: "EXTRACTED",
        inFlightSinceMs: 1000,
      },
    ];
    const next = reconcileSessionItems(
      items,
      [
        { id: "doc-a", status: "PROCESSED", lastStage: "done" },
        { id: "doc-b", status: "ANALYZING", lastStage: "company_analysis" },
      ],
      5000,
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.status).toBe("PROCESSED");
    expect(next[0]?.inFlightSinceMs).toBeUndefined();
    expect(next[0]?.pollError).toBeUndefined();
    expect(next[1]?.status).toBe("ANALYZING");
    expect(next[1]?.inFlightSinceMs).toBe(1000);
  });

  it("drops session items whose documentId is gone (deleted)", () => {
    const next = reconcileSessionItems(
      [
        {
          localId: "local-1",
          documentId: "doc-deleted",
          phase: "done",
          status: "CURRENT" as string,
        },
        {
          localId: "local-2",
          documentId: "doc-keep",
          phase: "done",
          status: "PROCESSED",
        },
      ],
      [{ id: "doc-keep", status: "PROCESSED" }],
    );
    expect(next.map((i) => i.documentId)).toEqual(["doc-keep"]);
  });

  it("keeps in-progress uploads without a documentId", () => {
    const next = reconcileSessionItems(
      [{ localId: "uploading", phase: "uploading", progress: 10 } as never],
      [],
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.localId).toBe("uploading");
  });

  it("continues polling when only session is still in-flight", () => {
    expect(
      shouldPollUploadLists({
        recentStatuses: ["PROCESSED"],
        sessionStatuses: ["ANALYZING"],
      }),
    ).toBe(true);
    expect(
      shouldPollUploadLists({
        recentStatuses: ["PROCESSED"],
        sessionStatuses: ["PROCESSED"],
      }),
    ).toBe(false);
  });

  it("surfaces a poll timeout with actionable message", () => {
    const timed = applySessionPollTimeouts(
      [
        {
          localId: "local-1",
          documentId: "doc-a",
          phase: "done",
          status: "ANALYZING",
          inFlightSinceMs: 0,
        },
      ],
      6 * 60 * 1000,
      5 * 60 * 1000,
    );
    expect(timed[0]?.pollError).toBe(SESSION_POLL_TIMEOUT_MESSAGE);
  });

  it("skips reprocess while already in-flight", () => {
    expect(shouldSkipReprocess("QUEUED")).toBe(true);
    expect(shouldSkipReprocess("ANALYZING")).toBe(true);
    expect(shouldSkipReprocess("PROCESSED")).toBe(false);
    expect(shouldSkipReprocess("FAILED")).toBe(false);
  });
});
