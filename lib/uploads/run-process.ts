import type { AppSupabaseClient } from "@/lib/supabase/client";
import { waitUntil } from "@vercel/functions";
import {
  claimDocumentJob,
  type DocumentJobRow,
} from "./claim";
import {
  continueClaimedManualUpload,
  processManualUploadDocument,
  type ProcessDocumentResult,
} from "./process";
import { logUploadProcessingEvent } from "./logging";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";

export type AcceptProcessResult = {
  accepted: boolean;
  claimed: boolean;
  skipped?: boolean;
  documentId: string;
  companyId: string;
  status: string;
  stage: string;
  /** Present when mode=sync finished in this invocation. */
  result?: ProcessDocumentResult;
};

/**
 * Atomically claim a QUEUED (or stale) document and either:
 * - sync: await extract → evidence → Insight Engine → PROCESSED|FAILED
 * - accept: return after claim; finish via waitUntil
 */
export async function acceptDocumentForProcessing(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  mode: "accept" | "sync";
}): Promise<AcceptProcessResult> {
  const { client, companyId, documentId, mode } = input;

  if (mode === "sync") {
    logUploadProcessingEvent("manual_upload_processing_started", {
      documentId,
      companyId,
      stage: "claim",
      outcome: "started",
      status: "PROCESSING",
    });

    const result = await processManualUploadDocument({
      client,
      companyId,
      documentId,
    });

    if (result.status === "processed") {
      logUploadProcessingEvent("manual_upload_processing_completed", {
        documentId,
        companyId,
        stage: "processed",
        outcome: "processed",
        status: "PROCESSED",
      });
    } else if (result.status === "failed") {
      logUploadProcessingEvent("manual_upload_processing_failed", {
        documentId,
        companyId,
        stage: "failed",
        outcome: "failed",
        status: "FAILED",
        errorMessage: result.errorMessage?.slice(0, 500),
      });
    }

    return {
      accepted: result.status !== "skipped",
      claimed: result.status !== "skipped",
      skipped: result.status === "skipped",
      documentId,
      companyId,
      status:
        result.status === "processed"
          ? "PROCESSED"
          : result.status === "failed"
            ? "FAILED"
            : result.status === "extracted"
              ? "EXTRACTED"
              : "skipped",
      stage: result.status,
      result,
    };
  }

  const claimed = await claimDocumentJob({
    client,
    companyId,
    documentId,
  });

  if (!claimed) {
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "claim",
      outcome: "skipped",
    });
    return {
      accepted: true,
      claimed: false,
      skipped: true,
      documentId,
      companyId,
      status: "skipped",
      stage: "claim",
    };
  }

  if (claimed.connector_id !== MANUAL_UPLOAD_CONNECTOR_ID) {
    return {
      accepted: false,
      claimed: false,
      documentId,
      companyId,
      status: "FAILED",
      stage: "claim",
    };
  }

  logUploadProcessingEvent("manual_upload_processing_started", {
    documentId,
    companyId,
    stage: "claim",
    outcome: "started",
    status: "PROCESSING",
  });

  scheduleContinue(client, companyId, claimed);

  return {
    accepted: true,
    claimed: true,
    documentId,
    companyId,
    status: "PROCESSING",
    stage: "claim",
  };
}

function scheduleContinue(
  client: AppSupabaseClient,
  companyId: string,
  claimed: DocumentJobRow,
): void {
  waitUntil(
    continueClaimedManualUpload({ client, companyId, claimed }).then(
      (result) => {
        if (result.status === "processed") {
          logUploadProcessingEvent("manual_upload_processing_completed", {
            documentId: claimed.id,
            companyId,
            stage: "processed",
            outcome: "processed",
            status: "PROCESSED",
          });
        } else if (result.status === "failed") {
          logUploadProcessingEvent("manual_upload_processing_failed", {
            documentId: claimed.id,
            companyId,
            stage: "failed",
            outcome: "failed",
            status: "FAILED",
            errorMessage: result.errorMessage?.slice(0, 500),
          });
        }
      },
    ),
  );
}
