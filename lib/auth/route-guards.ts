/**
 * Pure route-guard helpers for auth redirects (testable without Next runtime).
 */

export const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/doctor",
  "/brief",
  "/health",
  "/dna",
  "/timeline",
  "/evidence",
  "/reports",
  "/upload",
  "/connectors",
  "/onboarding",
  "/settings",
] as const;

export const PUBLIC_PATH_PREFIXES = ["/", "/demo"] as const;

export const AUTH_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isAuthPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return AUTH_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isPublicPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return PUBLIC_PATH_PREFIXES.some((prefix) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function isProtectedPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (isAuthPath(path) || isPublicPath(path)) return false;
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/_next")) return false;

  return PROTECTED_PATH_PREFIXES.some((prefix) => {
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

export type AuthRedirectInput = {
  pathname: string;
  isAuthenticated: boolean;
  hasCompany: boolean;
  /** When false, auth is skipped (should only be used in tests). */
  authEnabled: boolean;
};

export type AuthRedirectResult =
  | { type: "allow" }
  | { type: "redirect"; to: string };

/**
 * Decide where a request should go based on session + onboarding state.
 */
export function resolveAuthRedirect(
  input: AuthRedirectInput,
): AuthRedirectResult {
  if (!input.authEnabled) {
    return { type: "allow" };
  }

  const path = normalizePathname(input.pathname);

  if (!input.isAuthenticated) {
    if (isProtectedPath(path)) {
      const next = encodeURIComponent(path);
      return { type: "redirect", to: `/login?next=${next}` };
    }
    return { type: "allow" };
  }

  // Authenticated users on the marketing home → app
  if (path === "/") {
    return {
      type: "redirect",
      to: input.hasCompany ? "/dashboard" : "/onboarding",
    };
  }

  // Authenticated users on auth pages → app (except recovery password update)
  if (
    isAuthPath(path) &&
    path !== "/auth/callback" &&
    path !== "/reset-password"
  ) {
    return {
      type: "redirect",
      to: input.hasCompany ? "/dashboard" : "/onboarding",
    };
  }

  if (!input.hasCompany && isProtectedPath(path) && path !== "/onboarding") {
    return { type: "redirect", to: "/onboarding" };
  }

  if (input.hasCompany && path === "/onboarding") {
    return { type: "redirect", to: "/upload" };
  }

  return { type: "allow" };
}

/**
 * Validate that a requested companyId is in the caller's membership set.
 * Never trust browser-supplied company IDs without this check.
 */
export function assertCompanyAccess(
  memberships: readonly string[],
  companyId: string | null | undefined,
): string {
  if (!companyId) {
    throw new Error("company_id is required");
  }
  if (!memberships.includes(companyId)) {
    throw new Error("Unauthorized company access");
  }
  return companyId;
}

export function pickPrimaryCompanyId(
  memberships: readonly { companyId: string; createdAt: string }[],
): string | null {
  if (memberships.length === 0) return null;
  const sorted = [...memberships].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return sorted[0]?.companyId ?? null;
}
