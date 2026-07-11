import { describe, expect, it, vi } from "vitest";
import { isTransientDbConflict, withRetry } from "./retry";

describe("retry helpers", () => {
  it("detects timeline duplicate key conflicts", () => {
    expect(
      isTransientDbConflict(
        new Error(
          'replaceCompanyTimeline.insert: duplicate key value violates unique constraint "timeline_events_pkey"',
        ),
      ),
    ).toBe(true);
  });

  it("retries transient conflicts then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("duplicate key value"))
      .mockResolvedValueOnce("ok");
    await expect(
      withRetry(fn, { attempts: 3, baseDelayMs: 1 }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
