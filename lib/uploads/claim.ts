import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  MANUAL_UPLOAD_CONNECTOR_ID,
  PROCESSING_LEASE_SECONDS,
  PROCESSING_STALE_MS,
  TERMINAL_UPLOAD_STATUSES,
  type UploadDocumentStatus,
} from "./constants";

export type DocumentJobRow = Tables<"documents">;

/**
 * Atomically claim a document for processing (QUEUED or stale PROCESSING).
 * Returns null when another worker already holds a valid lease.
 */
export async function claimDocumentJob(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  leaseSeconds?: number;
}): Promise<DocumentJobRow | null> {
  const leaseSeconds = input.leaseSeconds ?? PROCESSING_LEASE_SECONDS;
  const { data, error } = await input.client.rpc(
    "claim_document_for_processing",
    {
      p_document_id: input.documentId,
      p_company_id: input.companyId,
      p_lease_seconds: leaseSeconds,
    },
  );

  if (error) {
    if (
      error.message.includes("claim_document_for_processing") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    ) {
      return claimDocumentJobFallback(input);
    }
    throw new Error(`claimDocumentJob: ${error.message}`);
  }

  if (!data) return null;
  return data as DocumentJobRow;
}

async function claimDocumentJobFallback(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  leaseSeconds?: number;
}): Promise<DocumentJobRow | null> {
  const leaseSeconds = input.leaseSeconds ?? PROCESSING_LEASE_SECONDS;
  const now = new Date();
  const leaseExpires = new Date(
    now.getTime() + leaseSeconds * 1000,
  ).toISOString();
  const staleBefore = new Date(
    now.getTime() - PROCESSING_STALE_MS,
  ).toISOString();

  const { data: current, error: loadError } = await input.client
    .from("documents")
    .select("*")
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`claimDocumentJobFallback.load: ${loadError.message}`);
  }
  if (!current) return null;

  const isQueued = current.status === "QUEUED";
  const isStaleProcessing =
    current.status === "PROCESSING" &&
    (!current.lease_expires_at ||
      current.lease_expires_at < now.toISOString() ||
      (current.locked_at != null && current.locked_at < staleBefore));

  if (!isQueued && !isStaleProcessing) return null;

  const { data: claimed, error: updateError } = await input.client
    .from("documents")
    .update({
      status: "PROCESSING",
      processing_started_at:
        current.processing_started_at ?? now.toISOString(),
      processing_attempts: (current.processing_attempts ?? 0) + 1,
      locked_at: now.toISOString(),
      lease_expires_at: leaseExpires,
      last_stage: "claim",
      error_message: null,
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(`claimDocumentJobFallback.update: ${updateError.message}`);
  }
  return claimed;
}

export async function updateDocumentStage(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  status: UploadDocumentStatus;
  lastStage: string;
  patch?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await input.client
    .from("documents")
    .update({
      status: input.status,
      last_stage: input.lastStage,
      ...input.patch,
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (error) {
    throw new Error(`updateDocumentStage: ${error.message}`);
  }
}

export async function markDocumentFailed(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  errorMessage: string;
  lastStage: string;
}): Promise<void> {
  const message = input.errorMessage.slice(0, 1000);
  await input.client
    .from("documents")
    .update({
      status: "FAILED",
      last_stage: input.lastStage,
      error_message: message,
      processing_completed_at: new Date().toISOString(),
      lease_expires_at: null,
      locked_at: null,
      metadata: {
        source: "manual-upload",
        error: message,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);
}

export async function markDocumentProcessed(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  rawSummary: string;
}): Promise<void> {
  await input.client
    .from("documents")
    .update({
      status: "PROCESSED",
      last_stage: "processed",
      raw_summary: input.rawSummary.slice(0, 2000),
      error_message: null,
      processing_completed_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      lease_expires_at: null,
      locked_at: null,
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);
}

/** Reset FAILED or stale in-flight jobs to QUEUED for retry. */
export async function requeueDocumentJobs(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentIds?: string[];
}): Promise<string[]> {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - PROCESSING_STALE_MS,
  ).toISOString();

  let query = input.client
    .from("documents")
    .select(
      "id, status, lease_expires_at, locked_at, processing_started_at, updated_at",
    )
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID);

  if (input.documentIds?.length) {
    query = query.in("id", input.documentIds);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`requeueDocumentJobs.list: ${error.message}`);

  const ids: string[] = [];
  for (const row of rows ?? []) {
    // Retry: FAILED always; QUEUED always (re-kickoff); in-flight only when stale.
    const canRetry =
      row.status === "FAILED" ||
      row.status === "QUEUED" ||
      (["PROCESSING", "EXTRACTED", "ANALYZING"].includes(row.status) &&
        isStaleForRetry(row, now, staleBefore));
    if (canRetry) ids.push(row.id);
  }

  if (ids.length === 0) return [];

  const { error: updateError } = await input.client
    .from("documents")
    .update({
      status: "QUEUED",
      last_stage: "requeued",
      error_message: null,
      locked_at: null,
      lease_expires_at: null,
      processing_completed_at: null,
      metadata: {
        source: "manual-upload",
        requeued_at: now.toISOString(),
      },
    })
    .eq("company_id", input.companyId)
    .in("id", ids);

  if (updateError) {
    throw new Error(`requeueDocumentJobs.update: ${updateError.message}`);
  }
  return ids;
}

function isStaleTimestamp(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return true;
  return now.getTime() - new Date(iso).getTime() >= PROCESSING_STALE_MS;
}

function isStaleForRetry(
  row: {
    status: string;
    lease_expires_at: string | null;
    locked_at: string | null;
    processing_started_at: string | null;
    updated_at: string;
  },
  now: Date,
  staleBefore: string,
): boolean {
  if (row.status === "QUEUED") {
    return isStaleTimestamp(row.updated_at, now);
  }
  if (row.lease_expires_at && row.lease_expires_at < now.toISOString()) {
    return true;
  }
  if (row.locked_at && row.locked_at < staleBefore) return true;
  if (row.processing_started_at && row.processing_started_at < staleBefore) {
    return true;
  }
  return false;
}

export function isTerminalUploadStatus(status: string): boolean {
  return (TERMINAL_UPLOAD_STATUSES as string[]).includes(status);
}
