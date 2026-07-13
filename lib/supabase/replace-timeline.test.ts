/**
 * replaceCompanyTimeline must be idempotent under reprocess / concurrent races.
 */

import { describe, expect, it } from "vitest";
import { replaceCompanyTimeline } from "@/lib/supabase/repository";
import type { TimelineEvent } from "@/lib/domain";

function makeEvent(id: string, title = "t"): TimelineEvent {
  return {
    id,
    companyId: "co-1",
    date: "2026-07-01",
    month: "Jul 2026",
    type: "evidence",
    title,
    description: title,
    summary: title,
    occurredAt: "2026-07-01T00:00:00.000Z",
    evidenceIds: [],
    findingIds: [],
    riskIds: [],
    causalChainId: id,
    rootEventId: id,
    confidence: 80,
    metadata: { eventKey: `tl-evidence-created-${id}` },
  };
}

describe("replaceCompanyTimeline idempotency", () => {
  it("upserts by id and does not fail when rows already exist", async () => {
    const existing = new Map<string, { id: string }>();
    existing.set("11111111-1111-4111-8111-111111111111", {
      id: "11111111-1111-4111-8111-111111111111",
    });

    const upserted: unknown[] = [];
    const deleted: string[] = [];

    const client = {
      from: (table: string) => {
        expect(table).toBe("timeline_events");
        return {
          upsert: async (rows: Array<{ id: string }>) => {
            upserted.push(...rows);
            for (const row of rows) existing.set(row.id, { id: row.id });
            return { data: rows, error: null };
          },
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [...existing.values()],
                error: null,
              }),
          }),
          delete: () => ({
            eq: () => ({
              in: async (_col: string, ids: string[]) => {
                deleted.push(...ids);
                for (const id of ids) existing.delete(id);
                return { data: null, error: null };
              },
            }),
          }),
        };
      },
    };

    const events = [
      makeEvent("11111111-1111-4111-8111-111111111111", "keep"),
      makeEvent("22222222-2222-4222-8222-222222222222", "new"),
      // duplicate id in batch — must not self-conflict
      makeEvent("22222222-2222-4222-8222-222222222222", "new-dup"),
    ];

    await expect(
      replaceCompanyTimeline(client as never, "co-1", events),
    ).resolves.toBeUndefined();

    expect(upserted).toHaveLength(2);
    expect(existing.has("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(existing.has("22222222-2222-4222-8222-222222222222")).toBe(true);
  });

  it("deletes all events when replacement set is empty", async () => {
    let deletedAll = false;
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => {
            deletedAll = true;
            return { data: null, error: null };
          },
        }),
      }),
    };

    await replaceCompanyTimeline(client as never, "co-1", []);
    expect(deletedAll).toBe(true);
  });
});
