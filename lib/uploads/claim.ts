import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  MANUAL_UPLOAD_CONNECTOR_ID,
  PROCESSING_LEASE_SECONDS,
  PROCESSING_STALE_MS,
  QUEUED_RETRY_AFTER_MS,
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
    // Unknown RPC error — still try fallback so jobs do not stay QUEUED.
    return claimDocumentJobFallback(input);
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
  const leaseExpired =
    current.lease_expires_at != null &&
    current.lease_expires_at < now.toISOString();
  const lockedStale =
    current.locked_at != null && current.locked_at < staleBefore;
  const isStaleProcessing =
    current.status === "PROCESSING" &&
    (current.lease_expires_at == null || leaseExpired || lockedStale);

  if (!isQueued && !isStaleProcessing) return null;

  const richPatch = {
    status: "PROCESSING" as const,
    processing_started_at: current.processing_started_at ?? now.toISOString(),
    processing_attempts: (current.processing_attempts ?? 0) + 1,
    locked_at: now.toISOString(),
    lease_expires_at: leaseExpires,
    last_stage: "claim",
    error_message: null,
  };

  const { data: claimed, error: updateError } = await input.client
    .from("documents")
    .update(richPatch)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle();

  if (!updateError && claimed) return claimed;

  // Minimal patch when migration 008 columns are not applied yet.
  const { data: minimal, error: minimalError } = await input.client
    .from("documents")
    .update({
      status: "PROCESSING",
      metadata: {
        source: "manual-upload",
        last_stage: "claim",
        processing_started_at: now.toISOString(),
        processing_attempts: (current.processing_attempts ?? 0) + 1,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle();

  if (minimalError) {
    throw new Error(
      `claimDocumentJobFallback.update: ${updateError?.message ?? minimalError.message}`,
    );
  }
  return minimal;
}

export async function updateDocumentStage(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  status: UploadDocumentStatus;
  lastStage: string;
  patch?: Record<string, unknown>;
}): Promise<void> {
  const rich = {
    status: input.status,
    last_stage: input.lastStage,
    ...input.patch,
  };
  const { error } = await input.client
    .from("documents")
    .update(rich)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (!error) return;

  // Pre-008 DBs reject EXTRACTED/ANALYZING — keep PROCESSING with stage metadata.
  const fallbackStatus =
    input.status === "EXTRACTED" || input.status === "ANALYZING"
      ? "PROCESSING"
      : input.status;

  const { error: fallbackError } = await input.client
    .from("documents")
    .update({
      status: fallbackStatus,
      metadata: {
        source: "manual-upload",
        last_stage: input.lastStage,
        logical_status: input.status,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (fallbackError) {
    throw new Error(
      `updateDocumentStage: ${error.message}; fallback: ${fallbackError.message}`,
    );
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
  const rich = {
    status: "FAILED" as const,
    last_stage: input.lastStage,
    error_message: message,
    processing_completed_at: new Date().toISOString(),
    lease_expires_at: null,
    locked_at: null,
    metadata: {
      source: "manual-upload",
      error: message,
      last_stage: input.lastStage,
    },
  };

  const { error } = await input.client
    .from("documents")
    .update(rich)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (!error) return;

  const { error: minimalError } = await input.client
    .from("documents")
    .update({
      status: "FAILED",
      metadata: {
        source: "manual-upload",
        error: message,
        last_stage: input.lastStage,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (minimalError) {
    throw new Error(
      `markDocumentFailed: ${error.message}; fallback: ${minimalError.message}`,
    );
  }
}

export async function markDocumentProcessed(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  rawSummary?: string;
}): Promise<void> {
  const rich = {
    status: "PROCESSED" as const,
    last_stage: "processed",
    error_message: null,
    processing_completed_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
    lease_expires_at: null,
    locked_at: null,
    ...(input.rawSummary != null
      ? { raw_summary: input.rawSummary.slice(0, 2000) }
      : {}),
  };

  const { error } = await input.client
    .from("documents")
    .update(rich)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (!error) return;

  const { error: minimalError } = await input.client
    .from("documents")
    .update({
      status: "PROCESSED",
      ...(input.rawSummary != null
        ? { raw_summary: input.rawSummary.slice(0, 2000) }
        : {}),
      synced_at: new Date().toISOString(),
      metadata: {
        source: "manual-upload",
        last_stage: "processed",
        processing_completed_at: new Date().toISOString(),
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  if (minimalError) {
    throw new Error(
      `markDocumentProcessed: ${error.message}; fallback: ${minimalError.message}`,
    );
  }
}

/** Reset FAILED or QUEUED / stale in-flight jobs to QUEUED for retry. */
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
    const canRetry =
      row.status === "FAILED" ||
      (row.status === "QUEUED" &&
        now.getTime() - new Date(row.updated_at).getTime() >=
          QUEUED_RETRY_AFTER_MS) ||
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
    const { error: minimalError } = await input.client
      .from("documents")
      .update({
        status: "QUEUED",
        metadata: {
          source: "manual-upload",
          requeued_at: now.toISOString(),
          last_stage: "requeued",
        },
      })
      .eq("company_id", input.companyId)
      .in("id", ids);
    if (minimalError) {
      throw new Error(
        `requeueDocumentJobs.update: ${updateError.message}; fallback: ${minimalError.message}`,
      );
    }
  }
  return ids;
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
