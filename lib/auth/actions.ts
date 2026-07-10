"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createCompanyWorkspace,
  ensureProfileForUser,
  requireUser,
} from "@/lib/auth/session";
import { disconnectGoogleDrive } from "@/lib/connectors/google-drive";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import { listMembershipsForUser } from "@/lib/auth/session";

export type AuthActionResult = {
  ok: boolean;
  error?: string;
};

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createServerSupabaseClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || undefined },
      emailRedirectTo: origin
        ? `${origin}/auth/callback`
        : undefined,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data.user) {
    await ensureProfileForUser(data.user);
  }

  // If email confirmation is required, session may be null.
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
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}

export async function forgotPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false, error: "Email is required." };
  }

  const supabase = await createServerSupabaseClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login`,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!companyName) {
    return { ok: false, error: "Company name is required." };
  }

  try {
    await createCompanyWorkspace({
      userId: user.id,
      email: user.email ?? "",
      fullName:
        (user.user_metadata?.full_name as string | undefined) ?? null,
      companyName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  redirect("/connectors");
}

export async function disconnectDriveAction(): Promise<AuthActionResult> {
  try {
    const user = await requireUser();
    const memberships = await listMembershipsForUser(user.id);
    const companyId = memberships[0]?.companyId;
    if (!companyId) {
      return { ok: false, error: "No company workspace found." };
    }
    await disconnectGoogleDrive({ companyId });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
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

    await db.from("profiles").delete().eq("id", user.id);
    await db.auth.admin.deleteUser(user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
