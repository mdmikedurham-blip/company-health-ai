import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (see .env.example).`,
    );
  }
  return value;
}

/**
 * Server client with the service role key — bypasses RLS.
 * Use only in server routes / jobs; never expose to the browser.
 */
export function createServiceClient(): AppSupabaseClient {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/** True when public Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** True when service-role writes are available. */
export function isServiceRoleConfigured(): boolean {
  return (
    isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
