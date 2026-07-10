import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ensureProfileForUser,
  listMembershipsForUser,
} from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/auth/validation";

/**
 * GET /auth/callback
 * Handles email confirmation, password-recovery, and OAuth redirects from Supabase Auth.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/dashboard";
  const next = safeRedirectPath(nextRaw, "/dashboard");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureProfileForUser(data.user);

      if (next === "/reset-password") {
        return NextResponse.redirect(new URL("/reset-password", url.origin));
      }

      const memberships = await listMembershipsForUser(data.user.id);
      if (memberships.length === 0) {
        return NextResponse.redirect(new URL("/onboarding", url.origin));
      }

      return NextResponse.redirect(new URL(next, url.origin));
    }

    const errMsg = error?.message?.toLowerCase() ?? "";
    if (errMsg.includes("expired") || errMsg.includes("otp")) {
      return NextResponse.redirect(
        new URL(`/login?error=link_expired`, url.origin),
      );
    }
  }

  return NextResponse.redirect(
    new URL(`/login?error=auth_callback`, url.origin),
  );
}
