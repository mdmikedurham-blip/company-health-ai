"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createCompanyWorkspace,
  deleteCompanyWorkspace,
  ensureProfileForUser,
  getActiveCompanyId,
  listMembershipsForUser,
  requireUser,
} from "@/lib/auth/session";
import { disconnectGoogleDrive } from "@/lib/connectors/google-drive";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import { assertCanDeleteCompany } from "@/lib/auth/roles";
import {
  safeRedirectPath,
  sanitizeAuthError,
  validateCompanyName,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  validateTermsAccepted,
} from "@/lib/auth/validation";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export type AuthActionResult = {
  ok: boolean;
  error?: string;
};

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const termsAccepted =
    formData.get("terms") === "on" || formData.get("terms") === "true";

  const limit = await checkRateLimit("auth.signup", email.toLowerCase());
  if (!limit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait and try again." };
  }

  const nameCheck = validateFullName(fullName);
  if (!nameCheck.ok) return nameCheck;
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return emailCheck;
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return passwordCheck;
  const confirmCheck = validatePasswordConfirmation(password, confirmPassword);
  if (!confirmCheck.ok) return confirmCheck;
  const termsCheck = validateTermsAccepted(termsAccepted);
  if (!termsCheck.ok) return termsCheck;

  const supabase = await createServerSupabaseClient();
  const origin = siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { ok: false, error: sanitizeAuthError(error.message) };
  }

  if (data.user) {
    await ensureProfileForUser(data.user);
  }

  if (!data.session) {
    redirect(`/login?confirm=1&email=${encodeURIComponent(email)}`);
  }

  redirect("/onboarding");
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return emailCheck;
  if (!password) {
    return { ok: false, error: "Password is required." };
  }

  const limit = await checkRateLimit("auth.login", email.toLowerCase());
  if (!limit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait and try again." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: sanitizeAuthError(error.message) };
  }

  redirect(safeRedirectPath(next));
}

export async function forgotPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return emailCheck;

  const supabase = await createServerSupabaseClient();
  const origin = siteOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { ok: false, error: sanitizeAuthError(error.message) };
  }

  // Always succeed to avoid email enumeration.
  return { ok: true };
}

export async function resetPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return passwordCheck;
  const confirmCheck = validatePasswordConfirmation(password, confirmPassword);
  if (!confirmCheck.ok) return confirmCheck;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your reset session expired. Request a new link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: sanitizeAuthError(error.message) };
  }

  redirect("/login?reset=1");
}

export async function signInWithGoogleAction(
  nextPath?: string,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const origin = siteOrigin();
  const next = safeRedirectPath(nextPath, "/dashboard");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return {
      ok: false,
      error: sanitizeAuthError(error?.message ?? "Google sign-in is unavailable."),
    };
  }

  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function completeOnboardingAction(
  formData: FormData,
): Promise<AuthActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Sign in to finish onboarding." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();

  const nameCheck = validateFullName(fullName);
  if (!nameCheck.ok) return nameCheck;
  const companyCheck = validateCompanyName(companyName);
  if (!companyCheck.ok) return companyCheck;

  try {
    await createCompanyWorkspace({
      userId: user.id,
      email: user.email ?? "",
      fullName,
      companyName,
    });
  } catch {
    return {
      ok: false,
      error: "Could not create your workspace. Please try again.",
    };
  }

  redirect("/connectors");
}

export async function disconnectDriveAction(): Promise<AuthActionResult> {
  try {
    const user = await requireUser();
    const companyId = await getActiveCompanyId(user.id);
    if (!companyId) {
      return { ok: false, error: "No company workspace found." };
    }
    await disconnectGoogleDrive({ companyId });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not disconnect Google Drive." };
  }
}

export async function deleteCompanyAction(): Promise<AuthActionResult> {
  try {
    const user = await requireUser();
    const memberships = await listMembershipsForUser(user.id);
    const companyId = await getActiveCompanyId(user.id);
    if (!companyId) {
      return { ok: false, error: "No company workspace found." };
    }
    const membership = memberships.find((m) => m.companyId === companyId);
    assertCanDeleteCompany(membership?.role);
    await deleteCompanyWorkspace({ companyId, userId: user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("owner role")) {
      return { ok: false, error: "Only company owners can delete the workspace." };
    }
    return { ok: false, error: "Could not delete company workspace." };
  }

  redirect("/onboarding");
}

export async function deleteAccountAction(): Promise<AuthActionResult> {
  try {
    const user = await requireUser();
    if (!isServiceRoleConfigured()) {
      return { ok: false, error: "Account deletion is not configured." };
    }

    const db = createServiceClient();
    const memberships = await listMembershipsForUser(user.id, db);

    for (const membership of memberships) {
      if (membership.role === "owner") {
        await disconnectGoogleDrive({
          companyId: membership.companyId,
          client: db,
        });
        await db.from("companies").delete().eq("id", membership.companyId);
      } else {
        await db
          .from("company_members")
          .delete()
          .eq("company_id", membership.companyId)
          .eq("user_id", user.id);
      }
    }

    await db.from("user_preferences").delete().eq("user_id", user.id);
    await db.from("profiles").delete().eq("id", user.id);
    await db.auth.admin.deleteUser(user.id);
  } catch {
    return { ok: false, error: "Could not delete your account." };
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
