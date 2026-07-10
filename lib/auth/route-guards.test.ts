import { describe, expect, it } from "vitest";
import {
  assertCompanyAccess,
  isAuthPath,
  isProtectedPath,
  isPublicPath,
  pickPrimaryCompanyId,
  resolveAuthRedirect,
} from "./route-guards";
import { createCompanyWorkspace } from "./session";

describe("protected route redirects", () => {
  it("marks product routes as protected", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/doctor")).toBe(true);
    expect(isProtectedPath("/brief")).toBe(true);
    expect(isProtectedPath("/health")).toBe(true);
    expect(isProtectedPath("/dna")).toBe(true);
    expect(isProtectedPath("/timeline")).toBe(true);
    expect(isProtectedPath("/evidence")).toBe(true);
    expect(isProtectedPath("/connectors")).toBe(true);
  });

  it("keeps marketing home and demo public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/demo")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/demo")).toBe(false);
  });

  it("does not protect auth routes or APIs", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/signup")).toBe(false);
    expect(isProtectedPath("/forgot-password")).toBe(false);
    expect(isProtectedPath("/reset-password")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/api/doctor")).toBe(false);
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(true);
  });

  it("allows password reset while authenticated", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/reset-password",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
  });

  it("protects settings and reports", () => {
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/reports")).toBe(true);
  });

  it("redirects unauthenticated users from protected routes to login", () => {
    const result = resolveAuthRedirect({
      pathname: "/doctor",
      isAuthenticated: false,
      hasCompany: false,
      authEnabled: true,
    });
    expect(result).toEqual({
      type: "redirect",
      to: "/login?next=%2Fdoctor",
    });
  });

  it("allows unauthenticated access to marketing and demo", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/",
        isAuthenticated: false,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
    expect(
      resolveAuthRedirect({
        pathname: "/demo",
        isAuthenticated: false,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "allow" });
  });

  it("sends authenticated users without a company to onboarding", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/connectors",
        isAuthenticated: true,
        hasCompany: false,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/onboarding" });
  });

  it("sends onboarded users from auth pages to dashboard", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/login",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });

  it("sends authenticated users from marketing home to dashboard", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/",
        isAuthenticated: true,
        hasCompany: true,
        authEnabled: true,
      }),
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });
});

describe("tenant isolation", () => {
  it("allows access only for membership company ids", () => {
    expect(assertCompanyAccess(["co-a", "co-b"], "co-a")).toBe("co-a");
    expect(() => assertCompanyAccess(["co-a"], "co-b")).toThrow(
      /Unauthorized company access/,
    );
  });

  it("rejects missing company id from the browser", () => {
    expect(() => assertCompanyAccess(["co-a"], undefined)).toThrow(
      /company_id is required/,
    );
  });

  it("user A cannot assert access to user B company", () => {
    const userAMemberships = ["company-a"];
    const userBCompany = "company-b";
    expect(() =>
      assertCompanyAccess(userAMemberships, userBCompany),
    ).toThrow(/Unauthorized company access/);
  });

  it("picks the earliest membership as primary company", () => {
    expect(
      pickPrimaryCompanyId([
        { companyId: "later", createdAt: "2026-02-01T00:00:00Z" },
        { companyId: "earlier", createdAt: "2026-01-01T00:00:00Z" },
      ]),
    ).toBe("earlier");
  });
});

describe("signup and company creation", () => {
  it("requires a non-empty company name", async () => {
    await expect(
      createCompanyWorkspace({
        userId: "user-1",
        email: "a@example.com",
        companyName: "   ",
      }),
    ).rejects.toThrow(/Company name is required|not configured/);
  });
});
