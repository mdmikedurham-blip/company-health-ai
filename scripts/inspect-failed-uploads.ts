/**
 * Inspect latest FAILED manual-upload rows (prints status fields only).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/inspect-failed-uploads.ts
 * or put the key in .env.local and run:
 *   npx tsx scripts/inspect-failed-uploads.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await sb
  .from("documents")
  .select(
    "id, filename, mime_type, status, last_stage, processing_attempts, error_message, processing_started_at, processing_completed_at, updated_at, company_id",
  )
  .eq("connector_id", "manual-upload")
  .eq("status", "FAILED")
  .order("updated_at", { ascending: false })
  .limit(15);

if (error) {
  console.error("query_error", error.message);
  process.exit(1);
}

for (const row of data ?? []) {
  console.log(
    JSON.stringify(
      {
        filename: row.filename,
        status: row.status,
        last_stage: row.last_stage,
        processing_attempts: row.processing_attempts,
        error_message: row.error_message,
        processing_started_at: row.processing_started_at,
        processing_completed_at: row.processing_completed_at,
        mime_type: row.mime_type,
        id: row.id,
      },
      null,
      2,
    ),
  );
}
