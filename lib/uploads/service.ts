import { randomUUID } from "node:crypto";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  COMPANY_DOCUMENTS_BUCKET,
  MANUAL_UPLOAD_CONNECTOR_ID,
  type ManualUploadMimeType,
} from "./constants";
import { buildStoragePath, sanitizeUploadFilename } from "./validation";

export type UploadedDocumentRecord = {
  id: string;
  companyId: string;
  filename: string;
  mimeType: string | null;
  byteSize: number | null;
  storagePath: string | null;
  status: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  leaseExpiresAt: string | null;
  lockedAt: string | null;
  processingStartedAt: string | null;
  lastStage: string | null;
  pipelineStep: string | null;
  lastSuccessfulPipelineStep: string | null;
  pipelineHeartbeatAt: string | null;
  failedStep: string | null;
  errorCategory: string | null;
  retryable: boolean | null;
  errorMessage: string | null;
  reprocessErrorMessage: string | null;
  extractionVersion: string | null;
  analysisVersion: string | null;
  lastSuccessfulExtractionVersion: string | null;
  lastSuccessfulAnalysisVersion: string | null;
};

export type SignedUploadSession = {
  documentId: string;
  storagePath: string;
  bucket: string;
  signedUrl: string;
  token: string;
  filename: string;
  mimeType: ManualUploadMimeType;
  byteSize: number;
};

const DOCUMENT_LIST_SELECT =
  "id, company_id, filename, title, mime_type, byte_size, storage_path, status, uploaded_by, created_at, updated_at, lease_expires_at, locked_at, processing_started_at, last_stage, pipeline_step, last_successful_pipeline_step, pipeline_heartbeat_at, failed_step, error_category, retryable, error_message, reprocess_error_message, extraction_version, analysis_version, last_successful_extraction_version, last_successful_analysis_version";

/** Narrower select when migration 023 columns are not applied yet. */
const DOCUMENT_LIST_SELECT_LEGACY =
  "id, company_id, filename, title, mime_type, byte_size, storage_path, status, uploaded_by, created_at, updated_at, lease_expires_at, locked_at, processing_started_at, last_stage, error_message, reprocess_error_message, extraction_version, analysis_version, last_successful_extraction_version, last_successful_analysis_version";

function rowToRecord(row: {
  id: string;
  company_id: string;
  filename: string | null;
  title: string;
  mime_type: string | null;
  byte_size: number | null;
  storage_path: string | null;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at?: string | null;
  lease_expires_at?: string | null;
  locked_at?: string | null;
  processing_started_at?: string | null;
  last_stage?: string | null;
  pipeline_step?: string | null;
  last_successful_pipeline_step?: string | null;
  pipeline_heartbeat_at?: string | null;
  failed_step?: string | null;
  error_category?: string | null;
  retryable?: boolean | null;
  error_message?: string | null;
  reprocess_error_message?: string | null;
  extraction_version?: string | null;
  analysis_version?: string | null;
  last_successful_extraction_version?: string | null;
  last_successful_analysis_version?: string | null;
}): UploadedDocumentRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    filename: row.filename ?? row.title,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    storagePath: row.storage_path,
    status: row.status,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
    lockedAt: row.locked_at ?? null,
    processingStartedAt: row.processing_started_at ?? null,
    lastStage: row.last_stage ?? null,
    pipelineStep: row.pipeline_step ?? null,
    lastSuccessfulPipelineStep: row.last_successful_pipeline_step ?? null,
    pipelineHeartbeatAt: row.pipeline_heartbeat_at ?? null,
    failedStep: row.failed_step ?? null,
    errorCategory: row.error_category ?? null,
    retryable: row.retryable ?? null,
    errorMessage: row.error_message ?? null,
    reprocessErrorMessage: row.reprocess_error_message ?? null,
    extractionVersion: row.extraction_version ?? null,
    analysisVersion: row.analysis_version ?? null,
    lastSuccessfulExtractionVersion:
      row.last_successful_extraction_version ?? null,
    lastSuccessfulAnalysisVersion: row.last_successful_analysis_version ?? null,
  };
}

/**
 * Create a documents row (status=UPLOADED) and a signed Storage upload URL.
 * Does not run extraction or analysis.
 */
export async function createManualUploadSession(input: {
  client: AppSupabaseClient;
  companyId: string;
  userId: string;
  filename: string;
  mimeType: ManualUploadMimeType;
  byteSize: number;
}): Promise<SignedUploadSession> {
  const documentId = randomUUID();
  const filename = sanitizeUploadFilename(input.filename);
  const storagePath = buildStoragePath({
    companyId: input.companyId,
    documentId,
    filename,
  });

  const now = new Date().toISOString();
  const baseInsert: TablesInsert<"documents"> = {
    id: documentId,
    company_id: input.companyId,
    connector_id: MANUAL_UPLOAD_CONNECTOR_ID,
    external_id: documentId,
    title: filename,
    filename,
    path: filename,
    mime_type: input.mimeType,
    byte_size: input.byteSize,
    storage_path: storagePath,
    uploaded_by: input.userId,
    status: "UPLOADED",
    last_stage: "upload",
    uri: `storage://${COMPANY_DOCUMENTS_BUCKET}/${storagePath}`,
    metadata: {
      source: "manual-upload",
      original_filename: input.filename,
      pipeline_step: "upload",
    },
    synced_at: now,
    modified_at: now,
    owner: input.userId,
  };

  const richInsert: TablesInsert<"documents"> = {
    ...baseInsert,
    pipeline_step: "upload",
    pipeline_heartbeat_at: now,
    pipeline_steps: [{ step: "upload", at: now, outcome: "started" }],
  };

  const { error: insertError } = await input.client
    .from("documents")
    .insert(richInsert);
  if (insertError) {
    const { error: fallbackError } = await input.client
      .from("documents")
      .insert(baseInsert);
    if (fallbackError) {
      throw new Error(
        `createManualUploadSession.insert: ${insertError.message}; fallback: ${fallbackError.message}`,
      );
    }
  }

  const { data: signed, error: signError } = await input.client.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    await input.client.from("documents").delete().eq("id", documentId);
    throw new Error(
      `createManualUploadSession.sign: ${signError?.message ?? "no signed url"}`,
    );
  }

  return {
    documentId,
    storagePath,
    bucket: COMPANY_DOCUMENTS_BUCKET,
    signedUrl: signed.signedUrl,
    token: signed.token,
    filename,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  };
}

/**
 * After the browser finishes uploading bytes to Storage, mark the document
 * QUEUED for the ingestion pipeline. Never runs analysis here.
 */
export async function completeManualUpload(input: {
  client: AppSupabaseClient;
  companyId: string;
  userId: string;
  documentId: string;
}): Promise<UploadedDocumentRecord> {
  const { data: row, error } = await input.client
    .from("documents")
    .select(
      "id, company_id, filename, title, mime_type, byte_size, storage_path, status, uploaded_by, created_at, updated_at, lease_expires_at, locked_at, processing_started_at, last_stage, error_message, connector_id",
    )
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`completeManualUpload.load: ${error.message}`);
  }
  if (!row) {
    throw new Error("Document not found");
  }
  if (row.uploaded_by && row.uploaded_by !== input.userId) {
    // Allow any company writer to complete; only block cross-tenant via company_id.
  }
  if (!row.storage_path) {
    throw new Error("Document is missing a storage path");
  }

  const { data: objects, error: listError } = await input.client.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .list(`${input.companyId}/${input.documentId}`, { limit: 5 });

  if (listError) {
    throw new Error(`completeManualUpload.verify: ${listError.message}`);
  }
  if (!objects || objects.length === 0) {
    throw new Error("Upload not found in storage. Retry the upload.");
  }

  const now = new Date().toISOString();
  const richUpdate = {
    status: "QUEUED" as const,
    synced_at: now,
    last_stage: "storage",
    pipeline_step: "storage",
    last_successful_pipeline_step: "upload",
    pipeline_heartbeat_at: now,
    metadata: {
      source: "manual-upload",
      queued_at: now,
      pipeline_step: "storage",
      last_successful_pipeline_step: "upload",
    },
  };

  let { data: updated, error: updateError } = await input.client
    .from("documents")
    .update(richUpdate)
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .select(DOCUMENT_LIST_SELECT)
    .single();

  if (updateError) {
    // Migration 023 columns may be absent — fall back.
    const fallback = await input.client
      .from("documents")
      .update({
        status: "QUEUED",
        synced_at: now,
        last_stage: "storage",
        metadata: richUpdate.metadata,
      })
      .eq("id", input.documentId)
      .eq("company_id", input.companyId)
      .select(DOCUMENT_LIST_SELECT_LEGACY)
      .single();
    updated = fallback.data as typeof updated;
    updateError = fallback.error;
  }

  if (updateError || !updated) {
    throw new Error(
      `completeManualUpload.enqueue: ${updateError?.message ?? "update failed"}`,
    );
  }

  return rowToRecord(updated);
}

export async function listManualUploads(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
}): Promise<UploadedDocumentRecord[]> {
  const primary = await input.client
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (!primary.error) {
    return (primary.data ?? []).map(rowToRecord);
  }

  const legacy = await input.client
    .from("documents")
    .select(DOCUMENT_LIST_SELECT_LEGACY)
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (legacy.error) {
    throw new Error(`listManualUploads: ${legacy.error.message}`);
  }

  return (legacy.data ?? []).map(rowToRecord);
}

export async function companyHasPendingUploads(
  client: AppSupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .in("status", ["UPLOADED", "QUEUED", "PROCESSING", "EXTRACTED", "ANALYZING"])
    .limit(1);

  if (error) {
    throw new Error(`companyHasPendingUploads: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}

export async function companyHasManualUploads(
  client: AppSupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .limit(1);

  if (error) {
    throw new Error(`companyHasManualUploads: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}
