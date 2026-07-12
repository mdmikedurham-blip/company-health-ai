/**
 * Server-side auth form validation. Keep business rules out of React components.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "Email is required." };
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { ok: false, error: "Password is required." };
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      ok: false,
      error: "Password must include at least one letter and one number.",
    };
  }
  return { ok: true };
}

export function validatePasswordConfirmation(
  password: string,
  confirm: string,
): ValidationResult {
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }
  return { ok: true };
}

export function validateCompanyName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Company name is required." };
  if (trimmed.length < 2) {
    return { ok: false, error: "Company name must be at least 2 characters." };
  }
  if (trimmed.length > 120) {
    return { ok: false, error: "Company name is too long." };
  }
  return { ok: true };
}

export function validateFullName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Full name is required." };
  if (trimmed.length < 2) {
    return { ok: false, error: "Enter your full name." };
  }
  return { ok: true };
}

export function validateTermsAccepted(accepted: boolean): ValidationResult {
  if (!accepted) {
    return { ok: false, error: "You must accept the terms to continue." };
  }
  return { ok: true };
}

/** Map provider/DB errors to safe user-facing messages. */
export function sanitizeAuthError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed")
  ) {
    if (lower.includes("email not confirmed")) {
      return "Confirm your email before signing in.";
    }
    return "Invalid email or password.";
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return "An account with this email already exists.";
  }
  if (lower.includes("expired") || lower.includes("otp")) {
    return "This link has expired. Request a new one.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait and try again.";
  }

  // Never leak raw provider/database details.
  return "Something went wrong. Please try again.";
}

export type AuthErrorCategory =
  | "redirect_configuration"
  | "rate_limited"
  | "provider_error"
  | "invalid_request";

/**
 * Categorize Supabase Auth errors for UI without leaking internals.
 */
export function categorizeAuthError(
  message: string | undefined | null,
): AuthErrorCategory {
  if (!message) return "provider_error";
  const lower = message.toLowerCase();

  if (
    lower.includes("redirect") ||
    lower.includes("not allowed") ||
    lower.includes("allow list") ||
    lower.includes("allowlist") ||
    lower.includes("site url") ||
    lower.includes("redirect_uri") ||
    lower.includes("redirect uri")
  ) {
    return "redirect_configuration";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "rate_limited";
  }
  if (
    lower.includes("invalid") ||
    lower.includes("validation") ||
    lower.includes("unable to validate") ||
    lower.includes("email address") ||
    lower.includes("bad request")
  ) {
    return "invalid_request";
  }
  return "provider_error";
}

export function authErrorCategoryMessage(
  category: AuthErrorCategory,
): string {
  switch (category) {
    case "redirect_configuration":
      return "Password reset redirect is misconfigured. Please try again later or contact support.";
    case "rate_limited":
      return "Too many attempts. Please wait and try again.";
    case "invalid_request":
      return "Check the email address and try again.";
    case "provider_error":
    default:
      return "Could not start password reset. Please try again.";
  }
}

export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
