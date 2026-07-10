import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./token-encryption";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("token-encryption", () => {
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a refresh token", () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    const plaintext = "1//0g-refresh-token-value";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext", () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });
});
