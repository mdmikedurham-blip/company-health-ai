import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOAuthState, parseOAuthState } from "./auth";

describe("Google Drive OAuth state", () => {
  afterEach(() => {
    delete process.env.OAUTH_STATE_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("signs and verifies company id, user id, nonce, and expiration", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const state = createOAuthState({
      companyId: "company-uuid-1",
      userId: "user-uuid-1",
      nonce: "fixed-nonce-for-test",
    });
    const parsed = parseOAuthState(state);
    expect(parsed.companyId).toBe("company-uuid-1");
    expect(parsed.userId).toBe("user-uuid-1");
    expect(parsed.nonce).toBe("fixed-nonce-for-test");
    expect(parsed.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered state", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const state = createOAuthState({
      companyId: "company-uuid-1",
      userId: "user-uuid-1",
    });
    const [body] = state.split(".");
    expect(() => parseOAuthState(`${body}.bad-signature`)).toThrow(
      /Invalid OAuth state/,
    );
  });

  it("rejects state missing userId", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const body = Buffer.from(
      JSON.stringify({
        companyId: "company-uuid-1",
        nonce: "abc",
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", "test-state-secret")
      .update(body)
      .digest("base64url");
    expect(() => parseOAuthState(`${body}.${sig}`)).toThrow(
      /expired or malformed/,
    );
  });

  it("rejects state missing nonce", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const body = Buffer.from(
      JSON.stringify({
        companyId: "company-uuid-1",
        userId: "user-uuid-1",
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", "test-state-secret")
      .update(body)
      .digest("base64url");
    expect(() => parseOAuthState(`${body}.${sig}`)).toThrow(
      /expired or malformed/,
    );
  });

  it("rejects expired state", () => {
    process.env.OAUTH_STATE_SECRET = "test-state-secret";
    const body = Buffer.from(
      JSON.stringify({
        companyId: "company-uuid-1",
        userId: "user-uuid-1",
        nonce: "abc",
        exp: Date.now() - 1_000,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", "test-state-secret")
      .update(body)
      .digest("base64url");
    expect(() => parseOAuthState(`${body}.${sig}`)).toThrow(
      /expired or malformed/,
    );
  });
});
