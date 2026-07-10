import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import type { AppSupabaseClient } from "./client";

/**
 * Server Component / Server Action / Route Handler client.
 * Uses the anon key + request cookies; subject to RLS.
 */
export async function createServerSupabaseClient(): Promise<AppSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled in proxy.ts.
          }
        },
      },
    },
  ) as AppSupabaseClient;
}
