import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  resolveAuthRedirect,
} from "@/lib/auth/route-guards";

/**
 * Refresh the auth session and apply route guards.
 * Used from Next.js 16 `proxy.ts` (nodejs runtime).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Always enforce route protection. Without Supabase env, treat as logged out
  // so company data routes cannot be reached anonymously (use /demo instead).
  if (!isSupabaseConfigured()) {
    const decision = resolveAuthRedirect({
      pathname: request.nextUrl.pathname,
      isAuthenticated: false,
      hasCompany: false,
      authEnabled: true,
    });
    if (decision.type === "redirect") {
      return NextResponse.redirect(new URL(decision.to, request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasCompany = false;
  if (user) {
    const { data } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1);
    hasCompany = (data?.length ?? 0) > 0;
  }

  const decision = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    hasCompany,
    authEnabled: true,
  });

  if (decision.type === "redirect") {
    const target = new URL(decision.to, request.url);
    const redirectResponse = NextResponse.redirect(target);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}
