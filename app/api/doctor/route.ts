import { NextResponse } from "next/server";
import { askDoctor } from "@/lib/doctor";

/**
 * POST /api/doctor
 * Body: { question: string, companyId?: string, explainRiskId?: string }
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

  const { question, companyId, explainRiskId } = body as {
    question: string;
    companyId?: string;
    explainRiskId?: string;
  };

  try {
    const result = await askDoctor({
      question,
      companyId:
        typeof companyId === "string" ? companyId : undefined,
      explainRiskId:
        typeof explainRiskId === "string" ? explainRiskId : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
