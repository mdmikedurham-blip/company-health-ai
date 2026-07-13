import { NextResponse } from "next/server";
import {
  GOOGLE_DRIVE_CONNECTOR_ID,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";
import { buildSingleConnectorCatalog } from "@/lib/connectors/ingest";
import { unauthorizedCronResponse } from "@/lib/api/cron-auth";
import {
  analyzeAndPersistIncremental,
  shouldRescoreIncremental,
} from "@/lib/application/incremental-analysis";
import {
  companyBriefSeed,
  companyDNA as dnaProfile,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
} from "@/lib/data/company-profile";
import {
  createServiceClient,
  isSupabaseConfigured,
  listConnectedCompaniesForConnector,
} from "@/lib/supabase";
import { processQueuedManualUploads } from "@/lib/uploads";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";

export const maxDuration = 300;

/**
 * GET|POST /api/cron/sync-connectors
 *
 * Recovery path for manual uploads (QUEUED, abandoned PROCESSING / expired
 * leases, parked EXTRACTED, and stale ANALYZING) via the same worker as
 * immediate kickoff.
 * Also runs Google Drive incremental sync.
 *
 * Latency note: Vercel Hobby allows only once-daily crons. User-facing latency
 * depends on post-upload HTTP kickoff to /api/documents/process + authenticated
 * Retry — not this schedule. On Vercel Pro, set schedule to every five minutes
 * (cron: star-slash-5 space star space star space star space star).
 */
async function runScheduledSync(request: Request) {
  const unauthorized = unauthorizedCronResponse(request);
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const client = createServiceClient();

    const { data: queuedRows, error: queuedError } = await client
      .from("documents")
      .select("company_id")
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "QUEUED");

    if (queuedError) {
      throw new Error(queuedError.message);
    }

    const nowIso = new Date().toISOString();
    const { data: staleRows, error: staleError } = await client
      .from("documents")
      .select("company_id")
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "PROCESSING")
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`);

    if (staleError) {
      throw new Error(staleError.message);
    }

    // Parked EXTRACTED / stale ANALYZING docs need company analysis recovery.
    const { data: extractedRows, error: extractedError } = await client
      .from("documents")
      .select("company_id")
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "EXTRACTED");

    if (extractedError) {
      throw new Error(extractedError.message);
    }

    const { data: analyzingRows, error: analyzingError } = await client
      .from("documents")
      .select("company_id")
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "ANALYZING");

    if (analyzingError) {
      throw new Error(analyzingError.message);
    }

    const manualCompanyIds = [
      ...new Set([
        ...(queuedRows ?? []).map((row) => row.company_id),
        ...(staleRows ?? []).map((row) => row.company_id),
        ...(extractedRows ?? []).map((row) => row.company_id),
        ...(analyzingRows ?? []).map((row) => row.company_id),
      ]),
    ];
    const manualResults = [];
    for (const companyId of manualCompanyIds) {
      const result = await processQueuedManualUploads({
        client,
        companyId,
        limit: 25,
      });
      manualResults.push({ companyId, ...result });
    }

    const companyIds = await listConnectedCompaniesForConnector(
      client,
      GOOGLE_DRIVE_CONNECTOR_ID,
    );

    const results = [];
    for (const companyId of companyIds) {
      const sync = await syncGoogleDriveForCompany(companyId, client, {
        mode: "incremental",
      });

      let analysis: {
        status: "skipped" | "succeeded" | "failed";
        affected?: {
          findingIds: string[];
          riskIds: string[];
          dimensionIds: string[];
        };
        healthScore?: number;
        errorMessage?: string;
      } = { status: "skipped" };

      if (
        sync.status === "succeeded" &&
        shouldRescoreIncremental(sync.delta) &&
        sync.changedEvidenceIds.length > 0
      ) {
        try {
          const company =
            companyId === companyProfile.id
              ? companyProfile
              : { ...companyProfile, id: companyId, name: companyId };

          const snapshot = await analyzeAndPersistIncremental({
            company,
            changedEvidenceIds: sync.changedEvidenceIds,
            dimensionProfiles,
            dna: dnaProfile,
            reports: companyReports,
            timelineSeed: companyTimelineSeed,
            briefSeed: companyBriefSeed,
            evidenceCatalog: buildSingleConnectorCatalog({
              connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
              name: "Google Drive",
              system: "Google Drive",
              documentsAnalyzed: sync.documentsAnalyzed,
              lastSynced: new Date().toISOString(),
              lastFullScan: new Date().toISOString(),
            }),
            client,
          });
          analysis = {
            status: "succeeded",
            affected: snapshot.affected,
            healthScore: snapshot.healthScore.score,
          };
        } catch (err) {
          analysis = {
            status: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          };
        }
      }

      results.push({ sync, analysis });
    }

    return NextResponse.json({
      connectorId: GOOGLE_DRIVE_CONNECTOR_ID,
      companies: companyIds.length,
      manualUploads: {
        companies: manualCompanyIds.length,
        results: manualResults,
      },
      pipeline:
        "changed documents → affected findings → affected risks → affected dimensions",
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runScheduledSync(request);
}

export async function POST(request: Request) {
  return runScheduledSync(request);
}
