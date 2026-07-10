import type { AppSupabaseClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase";
import { getDocumentProcessSecret } from "@/lib/api/process-auth";
import { markDocumentFailed } from "./claim";
import { logUploadProcessingEvent } from "./logging";
import { acceptDocumentForProcessing } from "./run-process";

/** Small-file sync should finish well under this (hello.txt target). */
export const SYNC_PROCESS_TIMEOUT_MS = 30_000;

/** Processing must begin (leave QUEUED) within this window. */
export const PROCESSING_KICKOFF_TIMEOUT_MS = 10_000;

/** If processing cannot start at all, fail within this window. */
export const PROCESSING_START_DEADLINE_MS = 60_000;

/** Files at or under this size run mode=sync (hello.txt path). */
export const SYNC_PROCESS_MAX_BYTES = 1_000_000;

export type KickoffResult = {
  accepted: boolean;
  documentId: string;
  companyId: string;
  status?: string;
  mode?: "sync" | "accept";
  via?: "in-process" | "http";
  httpStatus?: number;
  errorMessage?: string;
};

/**
 * Production-safe kickoff: run the worker **in-process** and await it.
 *
 * Does not depend on CRON_SECRET, HTTP self-fetch, Next.js after hooks, or cron.
 * Complete always uses mode=sync so hello.txt reaches PROCESSED here.
 */
export async function kickoffDocumentProcessing(input: {
  companyId: string;
  documentId: string;
  mode?: "sync" | "accept";
  byteSize?: number | null;
  request?: Request;
  client?: AppSupabaseClient;
}): Promise<KickoffResult> {
  const { companyId, documentId } = input;
  const byteSize = input.byteSize ?? null;
  const mode: "sync" | "accept" =
    input.mode ??
    (byteSize == null || byteSize <= SYNC_PROCESS_MAX_BYTES ? "sync" : "accept");

  logUploadProcessingEvent("manual_upload_processing_kickoff", {
    documentId,
    companyId,
    stage: "kickoff",
    outcome: "attempt",
    status: mode,
  });

  const client = input.client ?? createServiceClient();

  try {
    const accepted = await acceptDocumentForProcessing({
      client,
      companyId,
      documentId,
      mode,
    });

    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "kickoff",
      outcome: accepted.skipped ? "skipped" : "accepted",
      status: accepted.status,
    });

    if (accepted.skipped && mode === "sync") {
      // Could not claim — treat as start failure within deadline semantics.
      await markDocumentFailed({
        client,
        companyId,
        documentId,
        errorMessage:
          "processing_kickoff_failed: document was not claimable (still QUEUED)",
        lastStage: "kickoff",
      });
      logUploadProcessingEvent("manual_upload_processing_failed", {
        documentId,
        companyId,
        stage: "kickoff",
        outcome: "failed",
        errorMessage: "not_claimable",
      });
      return {
        accepted: false,
        documentId,
        companyId,
        status: "FAILED",
        mode,
        via: "in-process",
        errorMessage: "not_claimable",
      };
    }

    void notifyProcessRouteBestEffort({
      companyId,
      documentId,
      request: input.request,
    });

    return {
      accepted: true,
      documentId,
      companyId,
      status: accepted.status,
      mode,
      via: "in-process",
      httpStatus: mode === "sync" ? 200 : 202,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return failKickoff({
      client,
      companyId,
      documentId,
      mode,
      errorMessage,
    });
  }
}

async function notifyProcessRouteBestEffort(input: {
  companyId: string;
  documentId: string;
  request?: Request;
}): Promise<void> {
  const secret = getDocumentProcessSecret();
  if (!secret || !input.request) return;
  try {
    const host =
      input.request.headers.get("x-forwarded-host") ??
      input.request.headers.get("host");
    const proto = input.request.headers.get("x-forwarded-proto") ?? "https";
    if (!host) return;
    await fetch(`${proto}://${host}/api/documents/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        documentId: input.documentId,
        companyId: input.companyId,
        mode: "accept",
      }),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
  } catch {
    // Observability only — never required for correctness.
  }
}

async function failKickoff(input: {
  client?: AppSupabaseClient;
  companyId: string;
  documentId: string;
  mode: "sync" | "accept";
  errorMessage: string;
}): Promise<KickoffResult> {
  logUploadProcessingEvent("manual_upload_processing_kickoff", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: "kickoff",
    outcome: "failed",
    errorMessage: input.errorMessage.slice(0, 500),
  });
  logUploadProcessingEvent("manual_upload_processing_failed", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: "kickoff",
    outcome: "failed",
    errorMessage: input.errorMessage.slice(0, 500),
  });

  if (input.client) {
    await markDocumentFailed({
      client: input.client,
      companyId: input.companyId,
      documentId: input.documentId,
      errorMessage: `processing_kickoff_failed: ${input.errorMessage}`.slice(
        0,
        1000,
      ),
      lastStage: "kickoff",
    });
  }

  return {
    accepted: false,
    documentId: input.documentId,
    companyId: input.companyId,
    mode: input.mode,
    status: "FAILED",
    errorMessage: input.errorMessage,
    via: "in-process",
  };
}

export async function kickoffDocumentProcessingBatch(input: {
  companyId: string;
  documentIds: string[];
  request?: Request;
  client?: AppSupabaseClient;
  mode?: "sync" | "accept";
}): Promise<KickoffResult[]> {
  const results: KickoffResult[] = [];
  for (const documentId of input.documentIds) {
    results.push(
      await kickoffDocumentProcessing({
        companyId: input.companyId,
        documentId,
        request: input.request,
        client: input.client,
        mode: input.mode ?? "sync",
      }),
    );
  }
  return results;
}
