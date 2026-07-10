import { after } from "next/server";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase";
import { processManualUploadDocument } from "./process";

/**
 * Schedule processing after the HTTP response is sent (Next.js `after`).
 * Does not block the upload/complete request on analysis completion.
 */
export function kickoffDocumentProcessing(input: {
  companyId: string;
  documentId: string;
  client?: AppSupabaseClient;
}): void {
  const companyId = input.companyId;
  const documentId = input.documentId;
  after(async () => {
    try {
      const client = input.client ?? createServiceClient();
      await processManualUploadDocument({
        client,
        companyId,
        documentId,
      });
    } catch {
      // Failures are persisted on the document row; avoid logging contents.
    }
  });
}

/**
 * Kick off many documents (retry / cron drain) without awaiting completion.
 */
export function kickoffDocumentProcessingBatch(input: {
  companyId: string;
  documentIds: string[];
  client?: AppSupabaseClient;
}): void {
  for (const documentId of input.documentIds) {
    kickoffDocumentProcessing({
      companyId: input.companyId,
      documentId,
      client: input.client,
    });
  }
}
