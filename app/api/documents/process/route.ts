import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { assertCanWrite } from "@/lib/auth/roles";
import { isAuthorizedProcessSecret } from "@/lib/api/process-auth";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  processManualUploadDocument,
  processQueuedManualUploads,
} from "@/lib/uploads/process";
import { acceptDocumentForProcessing } from "@/lib/uploads/run-process";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";
import { logUploadProcessingEvent } from "@/lib/uploads/logging";

export const maxDuration = 120;

/**
 * POST /api/documents/process
 *
 * Auth: Bearer DOCUMENT_PROCESS_SECRET|CRON_SECRET, or session member.
 * mode=sync: claim + extract + Insight Engine + PROCESSED|FAILED (awaited).
 * mode=accept: claim, return 202, finish via waitUntil.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Processing is not configured." },
        { status: 503 },
      );
    }

    const isInternal = isAuthorizedProcessSecret(request);
    let companyId: string | null = null;

    const body = (await request.json().catch(() => ({}))) as {
      documentId?: string;
      companyId?: string;
      mode?: "accept" | "sync" | "drain";
    };
    const documentId = String(body.documentId ?? "").trim() || null;
    const mode = body.mode ?? (documentId ? "accept" : "drain");

    if (isInternal) {
      companyId = String(body.companyId ?? "").trim() || null;
    } else {
      const { ctx, companyId: primary } = await requirePrimaryCompany();
      const membership = ctx.memberships.find((m) => m.companyId === primary);
      assertCanWrite(membership?.role);
      companyId = primary;
    }

    const client = createServiceClient();

    if (isInternal && !documentId) {
      const { data: companies, error } = await client
        .from("documents")
        .select("company_id")
        .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
        .in("status", ["QUEUED", "PROCESSING"]);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const companyIds = [
        ...new Set((companies ?? []).map((r) => r.company_id)),
      ];
      const results = [];
      for (const id of companyIds) {
        results.push({
          companyId: id,
          ...(await processQueuedManualUploads({
            client,
            companyId: id,
            limit: 25,
          })),
        });
      }
      return NextResponse.json({ mode: "drain", results });
    }

    if (!companyId) {
      return NextResponse.json(
        {
          error: isInternal
            ? "companyId is required for internal process calls"
            : "Unauthorized",
        },
        { status: isInternal ? 400 : 401 },
      );
    }

    if (!documentId) {
      const result = await processQueuedManualUploads({
        client,
        companyId,
        limit: 25,
      });
      return NextResponse.json({ mode: "company-drain", ...result });
    }

    const { data: doc, error } = await client
      .from("documents")
      .select("id, company_id, connector_id, status, byte_size")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId,
      companyId,
      stage: "route",
      outcome: "received",
      status: mode,
    });

    if (mode === "sync") {
      const accepted = await acceptDocumentForProcessing({
        client,
        companyId,
        documentId,
        mode: "sync",
      });
      return NextResponse.json(accepted, {
        status: accepted.skipped ? 200 : 200,
      });
    }

    if (mode === "drain") {
      const result = await processManualUploadDocument({
        client,
        companyId,
        documentId,
      });
      return NextResponse.json(result);
    }

    const accepted = await acceptDocumentForProcessing({
      client,
      companyId,
      documentId,
      mode: "accept",
    });

    return NextResponse.json(accepted, {
      status: accepted.claimed ? 202 : 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logUploadProcessingEvent("manual_upload_processing_failed", {
      stage: "route",
      outcome: "failed",
      errorMessage: message.slice(0, 500),
    });
    if (message.includes("write access")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
