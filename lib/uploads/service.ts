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

  const insert: TablesInsert<"documents"> = {
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
    uri: `storage://${COMPANY_DOCUMENTS_BUCKET}/${storagePath}`,
    metadata: {
      source: "manual-upload",
      original_filename: input.filename,
    },
    synced_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    owner: input.userId,
  };

  const { error: insertError } = await input.client
    .from("documents")
    .insert(insert);
  if (insertError) {
    throw new Error(`createManualUploadSession.insert: ${insertError.message}`);
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

  const { data: updated, error: updateError } = await input.client
    .from("documents")
    .update({
      status: "QUEUED",
      synced_at: new Date().toISOString(),
      metadata: {
        source: "manual-upload",
        queued_at: new Date().toISOString(),
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .select(DOCUMENT_LIST_SELECT)
    .single();

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
  const { data, error } = await input.client
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    throw new Error(`listManualUploads: ${error.message}`);
  }

  return (data ?? []).map(rowToRecord);
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
