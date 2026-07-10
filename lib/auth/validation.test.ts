import { describe, expect, it } from "vitest";
import {
  sanitizeAuthError,
  safeRedirectPath,
  validateCompanyName,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  validateTermsAccepted,
} from "./validation";
import {
  assertCanDeleteCompany,
  assertCanWrite,
  canDeleteCompany,
  canWriteCompanyData,
} from "./roles";
import {
  assertCompanyAccess,
  isAuthPath,
  isProtectedPath,
  isPublicPath,
  resolveAuthRedirect,
} from "./route-guards";

describe("auth form validation", () => {
  it("accepts a valid signup payload", () => {
    expect(validateFullName("Alex Rivera").ok).toBe(true);
    expect(validateEmail("alex@company.com").ok).toBe(true);
    expect(validatePassword("secret123").ok).toBe(true);
    expect(validatePasswordConfirmation("secret123", "secret123").ok).toBe(
      true,
    );
    expect(validateTermsAccepted(true).ok).toBe(true);
  });

  it("rejects weak passwords and mismatched confirmation", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("onlyletters").ok).toBe(false);
    expect(validatePasswordConfirmation("secret123", "other").ok).toBe(false);
  });

  it("rejects invalid email and missing terms", () => {
    expect(validateEmail("not-an-email").ok).toBe(false);
    expect(validateTermsAccepted(false).ok).toBe(false);
  });

  it("requires a company name for onboarding", () => {
    expect(validateCompanyName("").ok).toBe(false);
    expect(validateCompanyName("Acme").ok).toBe(true);
  });

  it("sanitizes duplicate signup and invalid login errors", () => {
    expect(sanitizeAuthError("User already registered")).toMatch(/already exists/i);
    expect(sanitizeAuthError("Invalid login credentials")).toMatch(/Invalid email/i);
    expect(sanitizeAuthError("Token has expired or is invalid")).toMatch(/expired/i);
    expect(sanitizeAuthError("relation does not exist")).toMatch(/Something went wrong/i);
  });

  it("only allows same-origin relative redirects", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
  });
});

describe("role authorization", () => {
  it("allows writers and blocks viewers from mutations", () => {
    expect(canWriteCompanyData("owner")).toBe(true);
    expect(canWriteCompanyData("admin")).toBe(true);
    expect(canWriteCompanyData("member")).toBe(true);
    expect(canWriteCompanyData("viewer")).toBe(false);
    expect(() => assertCanWrite("viewer")).toThrow(/write access required/);
  });

  it("allows only owners to delete a company", () => {
    expect(canDeleteCompany("owner")).toBe(true);
    expect(canDeleteCompany("admin")).toBe(false);
    expect(canDeleteCompany("viewer")).toBe(false);
    expect(() => assertCanDeleteCompany("admin")).toThrow(/owner role required/);
  });
});

describe("protected route redirects", () => {
  it("marks product routes as protected including settings and reports", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/reports")).toBe(true);
    expect(isProtectedPath("/connectors")).toBe(true);
  });

  it("keeps marketing home and demo public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/demo")).toBe(true);
    expect(isProtectedPath("/demo")).toBe(false);
  });

  it("treats reset-password as an auth path that stays reachable while logged in", () => {
    expect(isAuthPath("/reset-password")).toBe(true);
    expect(isProtectedPath("/reset-password")).toBe(false);
    expect(
      resolveAuthRedirect({
        pathname: "/reset-password",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
  });

  it("redirects unauthenticated users from protected routes to login", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/doctor",
        isAuthenticated: false,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/login?next=%2Fdoctor" });
  });

  it("allows unauthenticated access to demo", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/demo",
        isAuthenticated: false,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
  });

  it("sends first-login users without a company to onboarding", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/dashboard",
        isAuthenticated: true,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/onboarding" });
  });

  it("sends authenticated users away from login/signup", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/login",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/dashboard" });
    expect(
      resolveAuthRedirect({
        pathname: "/signup",
        isAuthenticated: true,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/onboarding" });
  });
});

describe("tenant isolation", () => {
  it("user A cannot read or modify user B company", () => {
    const userA = ["company-a"];
    expect(() => assertCompanyAccess(userA, "company-b")).toThrow(
      /Unauthorized company access/,
    );
  });

  it("denies unauthenticated-style missing company ids", () => {
    expect(() => assertCompanyAccess(["company-a"], null)).toThrow(
      /company_id is required/,
    );
  });
});
