import { NextResponse } from "next/server";
import {
  getDefaultCompanyId,
  syncGoogleDriveForCompany,
} from "@/lib/connectors/google-drive";
import { unauthorizedCronResponse } from "@/lib/api/cron-auth";

/**
 * POST /api/connectors/google-drive/sync
 * Manual or cron-triggered sync for one company.
 * Auth: Bearer CRON_SECRET (same as scheduled job).
 */
export async function POST(request: Request) {
  const unauthorized = unauthorizedCronResponse(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      companyId?: string;
    };
    const companyId = body.companyId ?? getDefaultCompanyId();
    const result = await syncGoogleDriveForCompany(companyId);
    const status =
      result.status === "failed" ? 500 : result.status === "skipped" ? 503 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
