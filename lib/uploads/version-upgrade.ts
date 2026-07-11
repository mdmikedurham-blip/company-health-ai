import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  MANUAL_UPLOAD_CONNECTOR_ID,
} from "./constants";
import {
  CURRENT_ANALYSIS_VERSION,
  CURRENT_EXTRACTION_VERSION,
  STALE_REPROCESS_BATCH_LIMIT,
  documentNeedsVersionUpgrade,
} from "./versions";
import { requeueDocumentJobs } from "./claim";

export type VersionUpgradeResult = {
  markedStale: string[];
  enqueued: string[];
};

/**
 * Mark PROCESSED (or prior OCR) docs behind current extractor/analyzer versions
 * as STALE, then enqueue them for reprocessing. Does not touch every document —
 * only version-behind rows.
 */
export async function markAndEnqueueStaleDocuments(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
  documentIds?: string[];
}): Promise<VersionUpgradeResult> {
  const limit = input.limit ?? STALE_REPROCESS_BATCH_LIMIT;
  const now = new Date().toISOString();

  let query = input.client
    .from("documents")
    .select(
      "id, status, extraction_version, analysis_version, last_successful_extraction_version, last_successful_analysis_version, next_reprocess_at, processing_attempts",
    )
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .in("status", ["PROCESSED", "STALE", "OCR_REQUIRED", "FAILED"]);

  if (input.documentIds?.length) {
    query = query.in("id", input.documentIds);
  }

  const { data: rows, error } = await query.limit(Math.max(limit * 4, 100));
  if (error) {
    throw new Error(`markAndEnqueueStaleDocuments.list: ${error.message}`);
  }

  const staleIds: string[] = [];
  for (const row of rows ?? []) {
    if (!documentNeedsVersionUpgrade(row)) continue;
    if (
      row.next_reprocess_at &&
      new Date(row.next_reprocess_at).getTime() > Date.now()
    ) {
      continue;
    }
    // Already in-flight upgrade path
    if (row.status === "STALE") {
      staleIds.push(row.id);
      continue;
    }
    staleIds.push(row.id);
  }

  const toMark = staleIds.slice(0, limit);
  if (toMark.length === 0) {
    return { markedStale: [], enqueued: [] };
  }

  const { error: markError } = await input.client
    .from("documents")
    .update({
      status: "STALE",
      last_stage: "version_stale",
      extraction_version: CURRENT_EXTRACTION_VERSION,
      analysis_version: CURRENT_ANALYSIS_VERSION,
      reprocess_error_message: null,
      metadata: {
        source: "manual-upload",
        last_stage: "version_stale",
        marked_stale_at: now,
        target_extraction_version: CURRENT_EXTRACTION_VERSION,
        target_analysis_version: CURRENT_ANALYSIS_VERSION,
      },
    })
    .eq("company_id", input.companyId)
    .in("id", toMark);

  if (markError) {
    throw new Error(`markAndEnqueueStaleDocuments.mark: ${markError.message}`);
  }

  const enqueued = await requeueDocumentJobs({
    client: input.client,
    companyId: input.companyId,
    documentIds: toMark,
    allowStatuses: ["STALE"],
    lastStage: "requeued_stale",
  });

  return { markedStale: toMark, enqueued };
}

/**
 * Auto-detect version-stale docs for a company and enqueue a bounded batch.
 * Safe to call from cron / process drain.
 */
export async function autoEnqueueVersionStaleDocuments(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
}): Promise<VersionUpgradeResult> {
  return markAndEnqueueStaleDocuments(input);
}
