import { NextResponse } from "next/server";
import { askDoctor } from "@/lib/doctor";
import {
  authErrorResponse,
  requirePrimaryCompany,
} from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * POST /api/doctor
 * Body: { question: string, explainRiskId?: string }
 * companyId is derived from the authenticated session when auth is enabled.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { question?: unknown }).question !== "string"
  ) {
    return NextResponse.json(
      { error: "question (string) is required" },
      { status: 400 },
    );
  }

  const { question, explainRiskId } = body as {
    question: string;
    explainRiskId?: string;
  };

  try {
    let companyId: string | undefined;
    if (isSupabaseConfigured()) {
      const session = await requirePrimaryCompany();
      companyId = session.companyId;
    }

    const result = await askDoctor({
      question,
      companyId,
      explainRiskId:
        typeof explainRiskId === "string" ? explainRiskId : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { message, status } = authErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
