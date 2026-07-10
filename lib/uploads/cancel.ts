import type { AppSupabaseClient } from "@/lib/supabase/client";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import {
  CANCELLED_ERROR,
  CANCELLED_LAST_STAGE,
} from "./removal-policy";
import { logUploadProcessingEvent } from "./logging";

export type CancelDocumentResult = {
  cancelled: boolean;
  documentId: string;
  companyId: string;
  status: string;
};

/**
 * Safely cancel in-flight processing. Sets FAILED + cancelled markers and
 * clears the lease so the worker aborts on the next stage check.
 */
export async function cancelManualUploadProcessing(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<CancelDocumentResult> {
  const { client, companyId, documentId } = input;

  const { data: doc, error } = await client
    .from("documents")
    .select(
      "id, company_id, connector_id, status, lease_expires_at, locked_at, processing_started_at, updated_at",
    )
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`cancelManualUploadProcessing.load: ${error.message}`);
  }
  if (!doc) {
    const err = new Error("Document not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  if (!["PROCESSING", "EXTRACTED", "ANALYZING"].includes(doc.status)) {
    const err = new Error(
      `Cannot cancel document in status ${doc.status}.`,
    );
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const { error: updateError } = await client
    .from("documents")
    .update({
      status: "FAILED",
      last_stage: CANCELLED_LAST_STAGE,
      error_message: CANCELLED_ERROR,
      lease_expires_at: null,
      locked_at: null,
      processing_completed_at: new Date().toISOString(),
      metadata: {
        source: "manual-upload",
        cancelled_at: new Date().toISOString(),
        cancelled_by_user: true,
      },
    })
    .eq("id", documentId)
    .eq("company_id", companyId)
    .in("status", ["PROCESSING", "EXTRACTED", "ANALYZING"]);

  if (updateError) {
    throw new Error(`cancelManualUploadProcessing.update: ${updateError.message}`);
  }

  logUploadProcessingEvent("manual_upload_processing_failed", {
    documentId,
    companyId,
    stage: "cancelled",
    outcome: "cancelled",
    status: "FAILED",
    errorMessage: CANCELLED_ERROR,
  });

  return {
    cancelled: true,
    documentId,
    companyId,
    status: "FAILED",
  };
}

/**
 * Returns true if the document was cancelled and the worker should stop.
 */
export async function wasProcessingCancelled(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<boolean> {
  const { data } = await input.client
    .from("documents")
    .select("status, last_stage, error_message")
    .eq("id", input.documentId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (!data) return true;
  return (
    data.status === "FAILED" &&
    (data.last_stage === CANCELLED_LAST_STAGE ||
      data.error_message === CANCELLED_ERROR)
  );
}
