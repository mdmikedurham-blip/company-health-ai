/**
 * Automatic recovery for abandoned pipeline jobs.
 *
 * If no heartbeat is received for PIPELINE_HEARTBEAT_STALE_MS (60s), reclaim
 * the job and continue from the last successful pipeline step — never force
 * a full restart of a healthy document.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  MANUAL_UPLOAD_CONNECTOR_ID,
  PROCESSING_STALE_MS,
  STALE_EXTRACTED_MS,
} from "./constants";
import { logUploadProcessingEvent } from "./logging";
import {
  PIPELINE_HEARTBEAT_STALE_MS,
  isPipelineStep,
  nextPipelineStep,
  requeueFromPipelineStep,
  resumePipelineStep,
  type PipelineStep,
} from "./pipeline";

export type StaleRecoveryResult = {
  requeuedProcessingIds: string[];
  staleExtractedIds: string[];
  /** ANALYZING → EXTRACTED so company analysis can retry. */
  recoveredAnalyzingIds: string[];
};

function heartbeatAbandoned(
  row: {
    pipeline_heartbeat_at?: string | null;
    lease_expires_at: string | null;
    locked_at: string | null;
    processing_started_at: string | null;
    updated_at: string;
  },
  now: Date,
): boolean {
  const heartbeatAt = row.pipeline_heartbeat_at;
  if (heartbeatAt) {
    return (
      now.getTime() - new Date(heartbeatAt).getTime() >=
      PIPELINE_HEARTBEAT_STALE_MS
    );
  }
  // No heartbeat column / never beat — fall back to lease / 60s updated_at.
  if (row.lease_expires_at) {
    return new Date(row.lease_expires_at).getTime() <= now.getTime();
  }
  const staleBefore = now.getTime() - PIPELINE_HEARTBEAT_STALE_MS;
  const anchors = [
    row.locked_at,
    row.processing_started_at,
    row.updated_at,
  ].filter(Boolean) as string[];
  if (anchors.length === 0) return true;
  return anchors.every((a) => new Date(a).getTime() <= staleBefore);
}

/**
 * Reclaim stuck PROCESSING / ANALYZING jobs (60s heartbeat) and continue
 * from the last successful pipeline step.
 * Returns EXTRACTED ids parked too long without analysis.
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
      "id, status, lease_expires_at, locked_at, processing_started_at, updated_at, last_stage, pipeline_step, last_successful_pipeline_step, failed_step, pipeline_heartbeat_at",
    )
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "PROCESSING")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (processingError) {
    // Pre-023 select may fail — retry without new columns.
    const legacy = await client
      .from("documents")
      .select(
        "id, status, lease_expires_at, locked_at, processing_started_at, updated_at, last_stage",
      )
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "PROCESSING")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (legacy.error) {
      throw new Error(
        `recoverAbandonedManualUploadJobs.processing: ${processingError.message}`,
      );
    }
    return recoverLegacyProcessing(client, companyId, legacy.data ?? [], now);
  }

  const abandoned = (processingRows ?? []).filter((row) =>
    heartbeatAbandoned(row, now),
  );
  const requeuedProcessingIds: string[] = [];

  for (const row of abandoned) {
    const lastSuccessful = isPipelineStep(row.last_successful_pipeline_step)
      ? row.last_successful_pipeline_step
      : null;
    const resumeStep = resumePipelineStep({
      failedStep: row.failed_step,
      lastSuccessfulStep: lastSuccessful,
    });

    await requeueFromPipelineStep({
      client,
      companyId,
      documentId: row.id,
      resumeStep,
      lastSuccessfulStep: lastSuccessful,
      reason: "heartbeat_stale_60s",
    });

    requeuedProcessingIds.push(row.id);
    logUploadProcessingEvent("manual_upload_lease_recovered", {
      documentId: row.id,
      companyId,
      stage: resumeStep,
      outcome: "requeued",
      status: "QUEUED",
      reason: "heartbeat_stale_60s",
      priorLastStage: row.last_stage ?? undefined,
      lastSuccessfulStep: lastSuccessful ?? undefined,
      resumeStep,
    });
  }

  // Stale ANALYZING — no heartbeat for 60s → park at EXTRACTED for assessment retry.
  const { data: analyzingRows, error: analyzingError } = await client
    .from("documents")
    .select(
      "id, updated_at, last_stage, pipeline_step, last_successful_pipeline_step, pipeline_heartbeat_at",
    )
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "ANALYZING")
    .order("updated_at", { ascending: true })
    .limit(limit);

  const recoveredAnalyzingIds: string[] = [];
  const analyzingList = analyzingError
    ? (
        await client
          .from("documents")
          .select("id, updated_at, last_stage")
          .eq("company_id", companyId)
          .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
          .eq("status", "ANALYZING")
          .limit(limit)
      ).data ?? []
    : analyzingRows ?? [];

  for (const row of analyzingList) {
    const heartbeatAt =
      "pipeline_heartbeat_at" in row
        ? (row as { pipeline_heartbeat_at?: string | null }).pipeline_heartbeat_at
        : null;
    const abandoned = heartbeatAbandoned(
      {
        pipeline_heartbeat_at: heartbeatAt,
        lease_expires_at: null,
        locked_at: null,
        processing_started_at: null,
        updated_at: row.updated_at,
      },
      now,
    );
    if (!abandoned) continue;

    const lastSuccessfulRaw =
      "last_successful_pipeline_step" in row
        ? (row as { last_successful_pipeline_step?: string | null })
            .last_successful_pipeline_step
        : null;
    const lastSuccessful: PipelineStep = isPipelineStep(lastSuccessfulRaw)
      ? lastSuccessfulRaw
      : "structured_fact_extraction";
    const resumeStep = nextPipelineStep(lastSuccessful);

    await requeueFromPipelineStep({
      client,
      companyId,
      documentId: row.id,
      resumeStep:
        resumeStep === "complete" ? "company_assessment_update" : resumeStep,
      lastSuccessfulStep: lastSuccessful,
      reason: "analyzing_heartbeat_stale_60s",
    });

    recoveredAnalyzingIds.push(row.id);
    logUploadProcessingEvent("manual_upload_stale_analyzing_recovered", {
      documentId: row.id,
      companyId,
      stage: "company_assessment_update",
      outcome: "requeued",
      status: "EXTRACTED",
      reason: "analyzing_heartbeat_stale_60s",
    });
  }
  // Parked EXTRACTED without analysis progress.
  const extractedCutoff = new Date(
    now.getTime() - Math.min(STALE_EXTRACTED_MS, PIPELINE_HEARTBEAT_STALE_MS),
  ).toISOString();
  const { data: extractedRows, error: extractedError } = await client
    .from("documents")
    .select("id, updated_at, pipeline_heartbeat_at")
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

  const staleExtractedIds = (extractedRows ?? [])
    .filter((row) => {
      if (!row.pipeline_heartbeat_at) return true;
      return (
        now.getTime() - new Date(row.pipeline_heartbeat_at).getTime() >=
        PIPELINE_HEARTBEAT_STALE_MS
      );
    })
    .map((r) => r.id);

  for (const id of staleExtractedIds) {
    logUploadProcessingEvent("manual_upload_stale_extracted", {
      documentId: id,
      companyId,
      stage: "finding_generation",
      outcome: "waiting",
      status: "EXTRACTED",
      reason: "awaiting_company_analysis",
      detail: PIPELINE_HEARTBEAT_STALE_MS.toString(),
    });
  }

  // Silence unused PROCESSING_STALE_MS when heartbeat path is primary.
  void PROCESSING_STALE_MS;

  return {
    requeuedProcessingIds,
    staleExtractedIds,
    recoveredAnalyzingIds,
  };
}

async function recoverLegacyProcessing(
  client: AppSupabaseClient,
  companyId: string,
  rows: Array<{
    id: string;
    lease_expires_at: string | null;
    locked_at: string | null;
    processing_started_at: string | null;
    updated_at: string;
    last_stage: string | null;
  }>,
  now: Date,
): Promise<StaleRecoveryResult> {
  const requeuedProcessingIds: string[] = [];
  for (const row of rows) {
    if (!heartbeatAbandoned(row, now)) continue;
    await requeueFromPipelineStep({
      client,
      companyId,
      documentId: row.id,
      resumeStep: "text_extraction",
      reason: "heartbeat_stale_60s_legacy",
    });
    requeuedProcessingIds.push(row.id);
  }
  return {
    requeuedProcessingIds,
    staleExtractedIds: [],
    recoveredAnalyzingIds: [],
  };
}
