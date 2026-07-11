/**
 * Audit the latest financial XLSX upload for a company.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/audit-latest-financial-xlsx.ts
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/audit-latest-financial-xlsx.ts <company_id>
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
const companyIdArg = process.argv[2];

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let docsQuery = sb
  .from("documents")
  .select(
    "id, company_id, filename, mime_type, status, last_stage, error_message, processing_started_at, processing_completed_at, created_at, updated_at, storage_path",
  )
  .eq("connector_id", "manual-upload")
  .or(
    "mime_type.ilike.%spreadsheet%,filename.ilike.%.xlsx,filename.ilike.%financial%,filename.ilike.%finance%",
  )
  .order("updated_at", { ascending: false })
  .limit(5);

if (companyIdArg) {
  docsQuery = docsQuery.eq("company_id", companyIdArg);
}

const { data: docs, error: docsError } = await docsQuery;
if (docsError) {
  console.error("documents_error", docsError.message);
  process.exit(1);
}

const doc = docs?.[0];
if (!doc) {
  console.log(JSON.stringify({ error: "no_financial_xlsx_found" }, null, 2));
  process.exit(0);
}

const companyId = doc.company_id as string;

const { data: evidenceRows } = await sb
  .from("evidence")
  .select("id, source_type, title, dimension_id, dimension_ids, reliability, extracted_facts, metadata, created_at")
  .eq("company_id", companyId)
  .or(`id.eq.${doc.id},metadata->>document_id.eq.${doc.id},metadata->>documentId.eq.${doc.id}`)
  .limit(10);

const { data: snapshots } = await sb
  .from("analysis_snapshots")
  .select("id, status, created_at, as_of, payload")
  .eq("company_id", companyId)
  .eq("status", "completed")
  .order("created_at", { ascending: false })
  .limit(2);

const { data: findings } = await sb
  .from("findings")
  .select("id, title, dimension_id, evidence_ids, score_impact, created_at")
  .eq("company_id", companyId)
  .contains("evidence_ids", [doc.id])
  .limit(20);

const { data: health } = await sb
  .from("health_scores")
  .select("id, score, status, confidence, dimensions, as_of, created_at")
  .eq("company_id", companyId)
  .order("as_of", { ascending: false })
  .limit(1)
  .maybeSingle();

const dims = (health?.dimensions as Array<Record<string, unknown>> | null) ?? [];
const financialDim = dims.find((d) => d.id === "dim-financial");

function redactFacts(facts: Record<string, unknown> | null | undefined) {
  if (!facts) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(facts)) {
    if (
      typeof v === "number" ||
      typeof v === "boolean" ||
      k.endsWith("Worksheet") ||
      k.endsWith("Period") ||
      k.endsWith("Basis") ||
      k.endsWith("Currency") ||
      k === "financialMetricKeys" ||
      k === "financialMetricCount" ||
      k === "financialFactsComplete" ||
      k === "missingFinancialFields" ||
      k === "evidenceType"
    ) {
      out[k] = v;
    } else if (typeof v === "string" && v.length < 80) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = `[array:${v.length}]`;
    }
  }
  return out;
}

console.log(
  JSON.stringify(
    {
      document: {
        id: doc.id,
        filename: doc.filename,
        mime_type: doc.mime_type,
        status: doc.status,
        last_stage: doc.last_stage,
        error_message: doc.error_message,
        processing_started_at: doc.processing_started_at,
        processing_completed_at: doc.processing_completed_at,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        company_id: companyId,
      },
      evidence: (evidenceRows ?? []).map((e) => ({
        id: e.id,
        source_type: e.source_type,
        title: e.title,
        dimension_id: e.dimension_id,
        dimension_ids: e.dimension_ids,
        metadata_document_id:
          (e.metadata as Record<string, unknown> | null)?.document_id ??
          (e.metadata as Record<string, unknown> | null)?.documentId ??
          null,
        extracted_facts: redactFacts(
          e.extracted_facts as Record<string, unknown> | null,
        ),
      })),
      analysis: {
        latest_snapshot_id: snapshots?.[0]?.id ?? null,
        snapshot_created_at: snapshots?.[0]?.created_at ?? null,
        findings_for_document: findings ?? [],
        financial_dimension: financialDim
          ? {
              scored: financialDim.scored,
              status: financialDim.status,
              score: financialDim.score,
              summary: financialDim.summary,
              evidenceCount: financialDim.evidenceCount,
              findingIds: financialDim.findingIds,
            }
          : null,
      },
    },
    null,
    2,
  ),
);
