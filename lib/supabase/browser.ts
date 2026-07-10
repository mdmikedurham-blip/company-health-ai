import {
  createBrowserClient as createSSRBrowserClient,
} from "@supabase/ssr";
import type { Database } from "./database.types";
import type { AppSupabaseClient } from "./client";
import { getSupabasePublicKey, getSupabaseUrl } from "./client";

/**
 * Browser Supabase client (anon/publishable key + cookies). Subject to RLS.
 * Never pass the service-role key here.
 */
export function createBrowserClient(): AppSupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  return createSSRBrowserClient<Database>(url, key) as AppSupabaseClient;
}
