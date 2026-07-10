import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * GET /auth/callback
 * Handles email confirmation and password-recovery redirects from Supabase Auth.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureProfileForUser(data.user);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(`/login?error=auth_callback`, url.origin),
  );
}
