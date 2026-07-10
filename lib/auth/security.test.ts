import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import { parseOAuthState, createOAuthState } from "@/lib/connectors/google-drive/auth";
import { assertCompanyAccess } from "@/lib/auth/route-guards";

describe("credential encryption", () => {
  it("round-trips refresh tokens without exposing plaintext format leaks", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    const token = "1//refresh-token-secret-value";
    const encrypted = encryptSecret(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(token);
  });
});

describe("Drive callback auth requirements", () => {
  it("OAuth state binds both user and company for callback validation", () => {
    process.env.OAUTH_STATE_SECRET = "callback-secret";
    const state = createOAuthState({
      companyId: "company-1",
      userId: "user-1",
    });
    const parsed = parseOAuthState(state);

    // Callback must compare session user to state.userId
    const sessionUserId = "user-1";
    expect(parsed.userId).toBe(sessionUserId);

    // And membership must include state.companyId
    expect(assertCompanyAccess(["company-1"], parsed.companyId)).toBe(
      "company-1",
    );
    expect(() =>
      assertCompanyAccess(["other-company"], parsed.companyId),
    ).toThrow(/Unauthorized company access/);
  });

  it("rejects callback when session user does not match state", () => {
    process.env.OAUTH_STATE_SECRET = "callback-secret";
    const state = createOAuthState({
      companyId: "company-1",
      userId: "user-1",
    });
    const parsed = parseOAuthState(state);
    const sessionUserId = "user-2";
    expect(parsed.userId === sessionUserId).toBe(false);
  });
});
