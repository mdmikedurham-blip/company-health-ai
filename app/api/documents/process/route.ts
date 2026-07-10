import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { assertCanWrite } from "@/lib/auth/roles";
import { unauthorizedCronResponse } from "@/lib/api/cron-auth";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  processManualUploadDocument,
  processQueuedManualUploads,
} from "@/lib/uploads/process";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";

export const maxDuration = 120;

/**
 * POST /api/documents/process
 * Body: { documentId?: string, companyId?: string } — companyId ignored for
 * session auth (derived from membership). Cron may omit documentId to drain.
 *
 * Auth: session member OR Bearer CRON_SECRET.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Processing is not configured." },
        { status: 503 },
      );
    }

    const cronUnauthorized = unauthorizedCronResponse(request);
    const isCron = cronUnauthorized === null;
    let companyId: string | null = null;

    if (!isCron) {
      // Session path — ignore browser companyId.
      const { ctx, companyId: primary } = await requirePrimaryCompany();
      const membership = ctx.memberships.find((m) => m.companyId === primary);
      assertCanWrite(membership?.role);
      companyId = primary;
    }

    const body = (await request.json().catch(() => ({}))) as {
      documentId?: string;
      companyId?: string;
    };
    const documentId = String(body.documentId ?? "").trim() || null;

    const client = createServiceClient();

    if (isCron && !companyId) {
      // Drain all companies with QUEUED / stale PROCESSING.
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (documentId) {
      // Confirm membership ownership of the document.
      const { data: doc, error } = await client
        .from("documents")
        .select("id, company_id, connector_id")
        .eq("id", documentId)
        .eq("company_id", companyId)
        .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
        .maybeSingle();

      if (error || !doc) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      }

      // Acknowledge immediately; run work after response when possible.
      after(async () => {
        await processManualUploadDocument({
          client,
          companyId: companyId!,
          documentId,
        });
      });

      return NextResponse.json({
        accepted: true,
        documentId,
        companyId,
      });
    }

    const result = await processQueuedManualUploads({
      client,
      companyId,
      limit: 25,
    });
    return NextResponse.json({ mode: "company-drain", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
