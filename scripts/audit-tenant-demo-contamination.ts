#!/usr/bin/env npx tsx
/**
 * Audit-only: identify likely demo/seed contamination in a company.
 * Does NOT delete anything. Review output before any cleanup.
 *
 * Usage:
 *   npx tsx scripts/audit-tenant-demo-contamination.ts <company_id_or_name>
 *
 * Marks rows as "suspect" when they match Acme mock fingerprints
 * (evidence ids like ev-board-minutes, connector doc counts totaling ~1292,
 * timeline seed metadata, etc.). Real manual-upload rows are listed as "keep".
 */

import { resolve } from "path";
import { config as loadEnvFromDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// dotenv/config equivalent pointed at .env.local (never log secrets).
loadEnvFromDotenv({ path: resolve(process.cwd(), ".env.local") });

const ACME_EVIDENCE_IDS = [
  "ev-board-minutes",
  "ev-arr-cohort",
  "ev-runway",
  "ev-cap-table",
];

const ACME_TITLE_FRAGMENTS = [
  "Meridian Corp",
  "Acme Corp",
  "June health score: 82",
  "Board minutes — May 2026",
  "ARR cohort analysis",
];

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: npx tsx scripts/audit-tenant-demo-contamination.ts <company_id_or_name>",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  let companyId = arg;
  if (!/^[0-9a-f-]{36}$/i.test(arg)) {
    const { data: companies, error } = await client
      .from("companies")
      .select("id, name")
      .ilike("name", `%${arg}%`)
      .limit(5);
    if (error) throw error;
    if (!companies?.length) {
      console.error("No company matched", arg);
      process.exit(1);
    }
    console.log("Matched companies:", companies);
    companyId = companies[0]!.id;
  }

  const { data: company } = await client
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  const { count: processedDocs } = await client
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("connector_id", "manual-upload")
    .eq("status", "PROCESSED");

  const { data: evidence } = await client
    .from("evidence")
    .select("id, title, source_system, document_id, metadata")
    .eq("company_id", companyId);

  const { data: risks } = await client
    .from("risks")
    .select("id, title")
    .eq("company_id", companyId);

  const { data: findings } = await client
    .from("findings")
    .select("id, title")
    .eq("company_id", companyId);

  const { data: scores } = await client
    .from("health_scores")
    .select("id, score, confidence, as_of, score_change")
    .eq("company_id", companyId)
    .order("as_of", { ascending: false })
    .limit(5);

  const { data: snapshots } = await client
    .from("analysis_snapshots")
    .select("id, created_at, payload, status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(10);

  const suspectEvidence = (evidence ?? []).filter((e) => {
    const idHit = ACME_EVIDENCE_IDS.some((id) => e.id.includes(id));
    const titleHit = ACME_TITLE_FRAGMENTS.some((t) =>
      (e.title ?? "").includes(t),
    );
    return idHit || titleHit;
  });

  const keepEvidence = (evidence ?? []).filter(
    (e) => !suspectEvidence.some((s) => s.id === e.id),
  );

  const report = {
    company,
    processed_manual_upload_documents: processedDocs ?? 0,
    evidence_total: evidence?.length ?? 0,
    evidence_suspect_demo: suspectEvidence.map((e) => ({
      id: e.id,
      title: e.title,
      reason: "matches Acme mock fingerprint",
    })),
    evidence_likely_real: keepEvidence.map((e) => ({
      id: e.id,
      title: e.title,
      document_id: e.document_id,
    })),
    risks_count: risks?.length ?? 0,
    findings_count: findings?.length ?? 0,
    latest_health_scores: scores,
    analysis_snapshots: snapshots,
    note:
      "This script never deletes. If suspect_demo is empty, fabricated UI metrics were from in-memory Acme fallback (fixed in app) — not necessarily bad DB rows. Review before any DELETE.",
    suggested_review_sql: {
      list_suspect_evidence: `
select id, title, source_system, document_id
from evidence
where company_id = '${companyId}'
  and (
    id like '%ev-board-minutes%'
    or title ilike '%Meridian Corp%'
    or title ilike '%Acme Corp%'
  );`,
      do_not_auto_delete:
        "Real uploaded documents live in documents + storage; only delete intelligence rows after confirming they are seed fingerprints.",
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
