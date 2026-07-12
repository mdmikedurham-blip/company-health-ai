import { describe, expect, it } from "vitest";
import {
  PASSWORD_RESET_ACCEPTED_MESSAGE,
  PRODUCTION_SITE_URL,
  PASSWORD_UPDATE_SUCCESS_PATH,
  isLocalhostOrigin,
  passwordResetRedirectTo,
  resolveSiteOrigin,
} from "./site-url";
import {
  authErrorCategoryMessage,
  categorizeAuthError,
} from "./validation";
import { resolveAuthCallback } from "./callback";
import {
  isAuthPath,
  resolveAuthRedirect,
} from "./route-guards";

describe("password recovery site URL", () => {
  it("builds the production redirect URL from NEXT_PUBLIC_SITE_URL", () => {
    expect(
      passwordResetRedirectTo({
        NEXT_PUBLIC_SITE_URL: PRODUCTION_SITE_URL,
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBe(`${PRODUCTION_SITE_URL}/auth/update-password`);
  });

  it("never uses localhost for production redirects", () => {
    const origin = resolveSiteOrigin({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(isLocalhostOrigin(origin)).toBe(false);
    expect(origin).toBe(PRODUCTION_SITE_URL);

    const redirect = passwordResetRedirectTo({
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(redirect).toBe(`${PRODUCTION_SITE_URL}/auth/update-password`);
    expect(redirect).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("allows localhost redirects only outside production", () => {
    expect(
      passwordResetRedirectTo({
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        NODE_ENV: "development",
      }),
    ).toBe("http://localhost:3000/auth/update-password");
  });

  it("uses noncommittal accepted messaging", () => {
    expect(PASSWORD_RESET_ACCEPTED_MESSAGE).toBe(
      "If an account exists for this email, a password-reset link has been requested. Delivery can take a few minutes.",
    );
    expect(PASSWORD_RESET_ACCEPTED_MESSAGE.toLowerCase()).not.toMatch(
      /has been sent|email was sent|definitely sent/,
    );
  });
});

describe("password recovery error categories", () => {
  it("categorizes Supabase redirect allow-list errors", () => {
    expect(
      categorizeAuthError("Redirect URL not allowed on the allow list"),
    ).toBe("redirect_configuration");
    expect(authErrorCategoryMessage("redirect_configuration")).toMatch(
      /redirect/i,
    );
  });

  it("categorizes rate limits and generic provider failures", () => {
    expect(categorizeAuthError("email rate limit exceeded")).toBe(
      "rate_limited",
    );
    expect(categorizeAuthError("unexpected upstream failure")).toBe(
      "provider_error",
    );
    expect(categorizeAuthError("Unable to validate email address")).toBe(
      "invalid_request",
    );
  });
});

describe("update-password recovery routing", () => {
  it("keeps /auth/update-password reachable while authenticated", () => {
    expect(isAuthPath("/auth/update-password")).toBe(true);
    expect(
      resolveAuthRedirect({
        pathname: "/auth/update-password",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
  });

  it("routes callback recovery next to /auth/update-password", async () => {
    const result = await resolveAuthCallback(
      { code: "abc", next: "/auth/update-password" },
      {
        exchangeCodeForSession: async () => ({ error: null }),
        getUser: async () => ({ user: { id: "u1" }, error: null }),
        hasCompanyMembership: async () => ({
          hasCompany: true,
          error: false,
        }),
      },
    );
    expect(result.path).toBe("/auth/update-password");
  });

  it("treats expired recovery exchange as confirmation failure for login", async () => {
    const result = await resolveAuthCallback(
      { code: "expired", next: "/auth/update-password" },
      {
        exchangeCodeForSession: async () => ({
          error: { message: "Token has expired or is invalid" },
        }),
        getUser: async () => ({ user: null, error: null }),
        hasCompanyMembership: async () => ({
          hasCompany: false,
          error: false,
        }),
      },
    );
    expect(result.path).toBe("/login?error=confirmation_failed");
  });

  it("sends successful password updates to login with reset flag", () => {
    expect(PASSWORD_UPDATE_SUCCESS_PATH).toBe("/login?reset=1");
  });
});
