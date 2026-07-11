import { describe, expect, it, vi } from "vitest";
import { isTimeoutError, TimeoutError, withTimeout } from "./timeout";

describe("withTimeout", () => {
  it("resolves when the promise wins the race", async () => {
    const value = await withTimeout(
      Promise.resolve("ok"),
      1_000,
      "storage_download",
    );
    expect(value).toBe("ok");
  });

  it("rejects with TimeoutError when the budget elapses", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      new Promise<string>(() => {
        /* never settles */
      }),
      50,
      "storage_download",
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      stage: "storage_download",
      timeoutMs: 50,
      code: "TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });

  it("isTimeoutError detects TimeoutError and timed-out messages", () => {
    expect(isTimeoutError(new TimeoutError("extract_document", 3_000))).toBe(
      true,
    );
    expect(
      isTimeoutError(new Error("extract_document timed out after 180s — abandoned")),
    ).toBe(true);
    expect(isTimeoutError(new Error("download failed"))).toBe(false);
  });
});
