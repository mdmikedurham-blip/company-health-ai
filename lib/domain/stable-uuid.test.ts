import { describe, expect, it } from "vitest";
import { deterministicUuid, stableFindingUuid } from "./stable-uuid";
import { isUuid } from "@/lib/uploads/evidence-id";

describe("deterministicUuid", () => {
  it("returns a stable RFC-like UUID for the same key", () => {
    const a = deterministicUuid("finding:finding-runway");
    const b = deterministicUuid("finding:finding-runway");
    expect(a).toBe(b);
    expect(isUuid(a)).toBe(true);
    expect(a).not.toBe(deterministicUuid("finding:finding-concentration"));
  });

  it("stableFindingUuid matches namespace", () => {
    expect(stableFindingUuid("finding-runway")).toBe(
      deterministicUuid("finding:finding-runway"),
    );
  });
});
