import type { AppSupabaseClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase";
import { getDocumentProcessSecret } from "@/lib/api/process-auth";
import { markDocumentFailed } from "./claim";
import { logUploadProcessingEvent } from "./logging";
import { acceptDocumentForProcessing } from "./run-process";

/** Confirm worker acceptance (claim) within this window for mode=accept. */
export const PROCESSING_KICKOFF_TIMEOUT_MS = 10_000;

/** Small files use mode=sync; complete may wait up to this long for PROCESSED. */
export const SYNC_PROCESS_TIMEOUT_MS = 30_000;

/** Files at or under this size run mode=sync (hello.txt path). */
export const SYNC_PROCESS_MAX_BYTES = 1_000_000;

export type KickoffResult = {
  accepted: boolean;
  documentId: string;
  companyId: string;
  status?: string;
  mode?: "sync" | "accept";
  via?: "http" | "in-process";
  httpStatus?: number;
  errorMessage?: string;
};

function resolveAppBaseUrl(request?: Request): string {
  // Prefer the incoming request host so kickoff hits THIS deployment
  // (NEXT_PUBLIC_SITE_URL can point at a different/old deployment).
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
 * Awaited kickoff to POST /api/documents/process with a server-only secret.
 * Falls back to the same in-process worker if HTTP self-fetch fails (Vercel).
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
    (byteSize != null && byteSize <= SYNC_PROCESS_MAX_BYTES ? "sync" : "accept");
  const timeoutMs =
    mode === "sync" ? SYNC_PROCESS_TIMEOUT_MS : PROCESSING_KICKOFF_TIMEOUT_MS;

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
        "DOCUMENT_PROCESS_SECRET or CRON_SECRET is not configured",
    });
  }

  const baseUrl = resolveAppBaseUrl(input.request);
  const url = `${baseUrl}/api/documents/process`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        documentId,
        companyId,
        mode,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

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

    if (res.ok) {
      const status =
        body.status ??
        body.result?.status ??
        (body.skipped ? "skipped" : "PROCESSING");
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
        via: "http",
        httpStatus,
      };
    }

    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "kickoff",
      outcome: "http_failed",
      httpStatus,
      errorMessage: (body.error ?? `HTTP ${httpStatus}`).slice(0, 500),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "kickoff",
      outcome: "http_failed",
      errorMessage: errorMessage.slice(0, 500),
    });
  }

  // Fallback: same worker code the route uses (no self-fetch deadlock).
  try {
    const client = input.client ?? createServiceClient();
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

    return {
      accepted: accepted.accepted || Boolean(accepted.skipped),
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
      client: input.client,
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
    errorMessage: input.errorMessage,
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
