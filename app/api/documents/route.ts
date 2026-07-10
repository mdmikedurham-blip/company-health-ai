import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { listManualUploads } from "@/lib/uploads";

/**
 * GET /api/documents
 * Lists recent manual uploads for the active company (no storage tokens).
 */
export async function GET() {
  try {
    const { companyId } = await requirePrimaryCompany();

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json({ documents: [], configured: false });
    }

    const client = createServiceClient();
    const documents = await listManualUploads({ client, companyId, limit: 50 });
    return NextResponse.json({ documents, configured: true });
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
