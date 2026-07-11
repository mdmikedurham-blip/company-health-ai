import { NextResponse } from "next/server";
import { requirePrimaryCompany } from "@/lib/auth/session";
import { confirmCompanyClassificationFields } from "@/lib/classification/persist";
import { COMPANY_LIFECYCLE_STAGES } from "@/lib/domain/company-classification";
import type { ConfirmedClassificationOverrides } from "@/lib/domain/company-classification";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Service role not configured." },
      { status: 503 },
    );
  }

  const { ctx, companyId } = await requirePrimaryCompany();
  const body = (await request.json()) as ConfirmedClassificationOverrides;

  const overrides: ConfirmedClassificationOverrides = {};
  if (
    body.stage &&
    (COMPANY_LIFECYCLE_STAGES as string[]).includes(body.stage)
  ) {
    overrides.stage = body.stage;
  }
  if (body.annualRevenueRange) {
    overrides.annualRevenueRange = body.annualRevenueRange;
  }
  if (body.employeeCountRange) {
    overrides.employeeCountRange = body.employeeCountRange;
  }
  if (body.fundingStatus) {
    overrides.fundingStatus = body.fundingStatus;
  }
  if (typeof body.boardPresent === "boolean") {
    overrides.boardPresent = body.boardPresent;
  }

  if (Object.keys(overrides).length === 0) {
    return NextResponse.json(
      { error: "No valid confirmation fields provided." },
      { status: 400 },
    );
  }

  try {
    const classification = await confirmCompanyClassificationFields({
      client: createServiceClient(),
      companyId,
      userId: ctx.user.id,
      overrides,
    });
    return NextResponse.json({ classification });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save classification confirmation.",
      },
      { status: 500 },
    );
  }
}
