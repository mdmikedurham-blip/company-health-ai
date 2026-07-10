import { afterEach, describe, expect, it } from "vitest";
import { createOAuthState, parseOAuthState } from "./auth";

describe("Google Drive OAuth state", () => {
  afterEach(() => {
    delete process.env.OAUTH_STATE_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("signs and verifies company id in state", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const state = createOAuthState("company-uuid-1");
    const parsed = parseOAuthState(state);
    expect(parsed.companyId).toBe("company-uuid-1");
    expect(parsed.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered state", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const state = createOAuthState("company-uuid-1");
    const [body] = state.split(".");
    expect(() => parseOAuthState(`${body}.bad-signature`)).toThrow(
      /Invalid OAuth state/,
    );
  });
});
