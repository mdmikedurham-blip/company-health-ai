import { safeRedirectPath } from "@/lib/auth/validation";

export type AuthCallbackQuery = {
  code: string | null;
  next: string | null;
};

export type AuthCallbackUser = {
  id: string;
};

/**
 * Dependencies for the auth callback so the route handler stays thin
 * and the decision logic can be unit-tested without Next/Supabase runtimes.
 */
export type AuthCallbackDeps = {
  exchangeCodeForSession: (
    code: string,
  ) => Promise<{ error: { message?: string } | null }>;
  getUser: () => Promise<{
    user: AuthCallbackUser | null;
    error: { message?: string } | null;
  }>;
  /**
   * Returns whether the user has at least one company membership.
   * Throws (or returns error: true) when the membership lookup itself fails.
   */
  hasCompanyMembership: (
    userId: string,
  ) => Promise<{ hasCompany: boolean; error: boolean }>;
};

export type AuthCallbackRedirect = {
  path: string;
};

/**
 * Establish session from an email/OAuth confirmation code, then decide
 * where the user should land. Never creates a company — that belongs in
 * /onboarding.
 */
export async function resolveAuthCallback(
  query: AuthCallbackQuery,
  deps: AuthCallbackDeps,
): Promise<AuthCallbackRedirect> {
  const next = safeRedirectPath(query.next, "/dashboard");

  if (!query.code) {
    return { path: "/login?error=missing_code" };
  }

  const { error: exchangeError } = await deps.exchangeCodeForSession(
    query.code,
  );
  if (exchangeError) {
    return { path: "/login?error=confirmation_failed" };
  }

  const { user, error: userError } = await deps.getUser();
  if (userError || !user) {
    return { path: "/login?error=session_failed" };
  }

  // Password recovery must land on the update form even if the user already
  // has a company membership.
  if (next === "/reset-password" || next === "/auth/update-password") {
    return { path: "/auth/update-password" };
  }

  let membership: { hasCompany: boolean; error: boolean };
  try {
    membership = await deps.hasCompanyMembership(user.id);
  } catch {
    return { path: "/onboarding?error=setup_failed" };
  }

  if (membership.error) {
    return { path: "/onboarding?error=setup_failed" };
  }

  if (!membership.hasCompany) {
    return { path: "/onboarding" };
  }

  return { path: "/dashboard" };
}

/** User-facing copy for /login?error=… query values from the callback. */
export function loginErrorMessage(
  error: string | null | undefined,
): string | null {
  switch (error) {
    case "missing_code":
      return "Confirmation link is incomplete. Request a new email and try again.";
    case "confirmation_failed":
      return "Email confirmation failed. The link may be expired or was opened in a different browser. Request a new link and open it in the same browser you used to sign up.";
    case "session_failed":
      return "Could not establish your session. Please sign in again.";
    case "link_expired":
      return "This link has expired. Request a new one.";
    case "auth_callback":
      return "Authentication failed. Please try signing in again.";
    default:
      return null;
  }
}

/** User-facing copy for /onboarding?error=… query values. */
export function onboardingErrorMessage(
  error: string | null | undefined,
): string | null {
  if (error === "setup_failed") {
    return "Your account is signed in, but workspace setup could not be verified. Create your company below to continue.";
  }
  return null;
}
