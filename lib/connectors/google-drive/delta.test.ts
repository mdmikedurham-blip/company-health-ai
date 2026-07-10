import { describe, expect, it } from "vitest";
import type { RawConnectorItem } from "../connector";
import {
  deltaHasWork,
  diffDocuments,
  isDocumentChanged,
  type StoredDocumentRef,
} from "./delta";

function item(
  id: string,
  opts: { hash?: string; modified?: string } = {},
): RawConnectorItem {
  return {
    externalId: id,
    title: id,
    syncedAt: "2026-07-09T12:00:00.000Z",
    rawSummary: "x",
    contentHash: opts.hash,
    modifiedAt: opts.modified,
  };
}

describe("diffDocuments", () => {
  it("classifies added, changed, unchanged, deleted", () => {
    const stored: StoredDocumentRef[] = [
      {
        id: "uuid-1",
        externalId: "a",
        contentHash: "md5:1",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "uuid-2",
        externalId: "b",
        contentHash: "md5:2",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "uuid-3",
        externalId: "c",
        contentHash: "md5:3",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const incoming = [
      item("a", { hash: "md5:1", modified: "2026-01-01T00:00:00.000Z" }),
      item("b", { hash: "md5:2-changed", modified: "2026-02-01T00:00:00.000Z" }),
      item("d", { hash: "md5:4", modified: "2026-03-01T00:00:00.000Z" }),
    ];

    const delta = diffDocuments(stored, incoming);
    expect(delta.unchanged.map((i) => i.externalId)).toEqual(["a"]);
    expect(delta.changed.map((i) => i.externalId)).toEqual(["b"]);
    expect(delta.added.map((i) => i.externalId)).toEqual(["d"]);
    expect(delta.deletedExternalIds).toEqual(["c"]);
    expect(deltaHasWork(delta)).toBe(true);
  });

  it("falls back to modified_at when hash missing", () => {
    expect(
      isDocumentChanged(
        { contentHash: null, modifiedAt: "2026-01-01T00:00:00.000Z" },
        { contentHash: undefined, modifiedAt: "2026-02-01T00:00:00.000Z" },
      ),
    ).toBe(true);
    expect(
      isDocumentChanged(
        { contentHash: null, modifiedAt: "2026-01-01T00:00:00.000Z" },
        { contentHash: undefined, modifiedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBe(false);
  });
});
