import {
  createBrowserClient as createSSRBrowserClient,
} from "@supabase/ssr";
import type { Database } from "./database.types";
import type { AppSupabaseClient } from "./client";

/**
 * Browser Supabase client (anon key + cookies). Subject to RLS.
 * Never pass the service-role key here.
 */
export function createBrowserClient(): AppSupabaseClient {
  return createSSRBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as AppSupabaseClient;
}
