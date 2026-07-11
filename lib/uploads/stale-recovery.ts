/**
 * Automatic recovery for abandoned extraction / EXTRACTED jobs.
 *
 * UI "Extracting" = DB status PROCESSING. Workers claim with a lease; if the
 * process is killed mid-download/extract, the lease stays until expiry and the
 * row never leaves PROCESSING unless something reclaims it.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  MANUAL_UPLOAD_CONNECTOR_ID,
  PROCESSING_STALE_MS,
  STALE_EXTRACTED_MS,
} from "./constants";
import { logUploadProcessingEvent } from "./logging";

export type StaleRecoveryResult = {
  requeuedProcessingIds: string[];
  staleExtractedIds: string[];
};

function isLeaseAbandoned(
  row: {
    lease_expires_at: string | null;
    locked_at: string | null;
    processing_started_at: string | null;
    updated_at: string;
  },
  now: Date,
): boolean {
  if (row.lease_expires_at) {
    return new Date(row.lease_expires_at).getTime() <= now.getTime();
  }
  const staleBefore = now.getTime() - PROCESSING_STALE_MS;
  const anchors = [
    row.locked_at,
    row.processing_started_at,
    row.updated_at,
  ].filter(Boolean) as string[];
  if (anchors.length === 0) return true;
  return anchors.every((a) => new Date(a).getTime() <= staleBefore);
}

/**
 * Requeue PROCESSING jobs whose lease expired / worker abandoned extraction.
 * Returns EXTRACTED ids that have been parked too long without analysis.
 */
export async function recoverAbandonedManualUploadJobs(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
  now?: Date;
}): Promise<StaleRecoveryResult> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 50;
  const { client, companyId } = input;

  const { data: processingRows, error: processingError } = await client
    .from("documents")
    .select(
      "id, status, lease_expires_at, locked_at, processing_started_at, updated_at, last_stage",
    )
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "PROCESSING")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (processingError) {
    throw new Error(
      `recoverAbandonedManualUploadJobs.processing: ${processingError.message}`,
    );
  }

  const abandoned = (processingRows ?? []).filter((row) =>
    isLeaseAbandoned(row, now),
  );
  const requeuedProcessingIds: string[] = [];

  for (const row of abandoned) {
    const reason =
      row.lease_expires_at &&
      new Date(row.lease_expires_at).getTime() <= now.getTime()
        ? "lease_expired"
        : "lease_missing_or_stale";

    const { data: updated, error } = await client
      .from("documents")
      .update({
        status: "QUEUED",
        last_stage: "lease_expired_recovery",
        error_message: null,
        locked_at: null,
        lease_expires_at: null,
        metadata: {
          source: "manual-upload",
          recovery_reason: reason,
          recovered_at: now.toISOString(),
          prior_last_stage: row.last_stage,
        },
      })
      .eq("id", row.id)
      .eq("company_id", companyId)
      .eq("status", "PROCESSING")
      // Only reclaim when lease is still expired / missing — never steal an active lease.
      .or(
        `lease_expires_at.is.null,lease_expires_at.lte.${now.toISOString()}`,
      )
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(
        `recoverAbandonedManualUploadJobs.requeue: ${error.message}`,
      );
    }
    if (!updated?.id) continue;

    requeuedProcessingIds.push(updated.id);
    logUploadProcessingEvent("manual_upload_lease_recovered", {
      documentId: updated.id,
      companyId,
      stage: "lease_recovery",
      outcome: "requeued",
      status: "QUEUED",
      reason,
      priorLastStage: row.last_stage ?? undefined,
      leaseExpiresAt: row.lease_expires_at ?? undefined,
    });
  }

  const extractedCutoff = new Date(
    now.getTime() - STALE_EXTRACTED_MS,
  ).toISOString();

  const { data: extractedRows, error: extractedError } = await client
    .from("documents")
    .select("id, updated_at, last_stage")
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "EXTRACTED")
    .lt("updated_at", extractedCutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (extractedError) {
    throw new Error(
      `recoverAbandonedManualUploadJobs.extracted: ${extractedError.message}`,
    );
  }

  const staleExtractedIds = (extractedRows ?? []).map((r) => r.id);
  for (const row of extractedRows ?? []) {
    logUploadProcessingEvent("manual_upload_stale_extracted_recovered", {
      documentId: row.id,
      companyId,
      stage: "stale_extracted",
      outcome: "needs_analysis",
      status: "EXTRACTED",
      updatedAt: row.updated_at ?? undefined,
      priorLastStage: row.last_stage ?? undefined,
    });
  }

  return { requeuedProcessingIds, staleExtractedIds };
}
