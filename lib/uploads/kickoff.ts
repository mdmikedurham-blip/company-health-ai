import type { AppSupabaseClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase";
import { getDocumentProcessSecret } from "@/lib/api/process-auth";
import { POST as processDocumentPost } from "@/app/api/documents/process/route";
import { markDocumentFailed } from "./claim";
import {
  logUploadProcessingEvent,
  logUploadProcessingException,
} from "./logging";

/** Small-file sync should finish well under this (hello.txt target). */
export const SYNC_PROCESS_TIMEOUT_MS = 30_000;

/** Processing must begin (leave QUEUED) within this window. */
export const PROCESSING_KICKOFF_TIMEOUT_MS = 10_000;

/** If processing cannot start at all, fail within this window. */
export const PROCESSING_START_DEADLINE_MS = 60_000;

/** Files at or under this size run mode=sync (hello.txt / small DOCX). */
export const SYNC_PROCESS_MAX_BYTES = 1_000_000;

export type KickoffResult = {
  accepted: boolean;
  documentId: string;
  companyId: string;
  status?: string;
  mode?: "sync" | "accept";
  via?: "process-route";
  httpStatus?: number;
  errorMessage?: string;
};

function resolveAppBaseUrl(request?: Request): string {
  if (request) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return "http://localhost:3000";
}

/**
 * After QUEUED: authenticated server-side call to POST /api/documents/process.
 *
 * Invokes the dedicated route handler with Bearer auth and awaits acceptance
 * (mode=sync awaits PROCESSED for small files). Avoids Vercel HTTP self-fetch
 * deadlocks while still executing the real process route.
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

  const secret = getDocumentProcessSecret();
  if (!secret) {
    return failKickoff({
      client: input.client,
      companyId,
      documentId,
      mode,
      errorMessage:
        "No process secret available (set DOCUMENT_PROCESS_SECRET, CRON_SECRET, or SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  const baseUrl = resolveAppBaseUrl(input.request);
  const url = `${baseUrl}/api/documents/process`;

  try {
    const processRequest = new Request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        documentId,
        companyId,
        mode,
      }),
    });

    const res = await processDocumentPost(processRequest);
    const httpStatus = res.status;
    let body: {
      accepted?: boolean;
      claimed?: boolean;
      skipped?: boolean;
      status?: string;
      error?: string;
      result?: { status?: string };
    } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }

    if (!res.ok) {
      return failKickoff({
        client: input.client,
        companyId,
        documentId,
        mode,
        errorMessage: body.error ?? `process route returned ${httpStatus}`,
      });
    }

    const status =
      body.status ??
      body.result?.status ??
      (body.skipped ? "skipped" : "PROCESSING");

    if (body.skipped && mode === "sync") {
      return failKickoff({
        client: input.client,
        companyId,
        documentId,
        mode,
        errorMessage: "process route could not claim document (still QUEUED)",
      });
    }

    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "kickoff",
      outcome: body.skipped ? "skipped" : "accepted",
      httpStatus,
      status,
    });

    return {
      accepted: true,
      documentId,
      companyId,
      status,
      mode,
      via: "process-route",
      httpStatus,
    };
  } catch (err) {
    logUploadProcessingException("manual_upload_processing_exception", {
      documentId,
      companyId,
      stage: "kickoff",
      err,
    });
    const errorMessage = err instanceof Error ? err.message : String(err);
    return failKickoff({
      client: input.client ?? createServiceClient(),
      companyId,
      documentId,
      mode,
      errorMessage,
    });
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
    via: "process-route",
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
