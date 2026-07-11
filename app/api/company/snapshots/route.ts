import { NextResponse } from "next/server";
import { authErrorResponse, requirePrimaryCompany } from "@/lib/auth/session";
import {
  diffAssessmentSnapshots,
  getAssessmentSnapshotById,
  getCurrentAssessmentSnapshot,
  listHistoricalAssessmentSnapshots,
} from "@/lib/assessment-snapshots";
import type { AssessmentSnapshotPack } from "@/lib/domain/assessment-snapshot";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/snapshots
 * ?current=1 — current published snapshot
 * ?history=1 — historical list
 * ?id=<uuid> — specific snapshot (tenant-scoped)
 * ?diff=1&previous=<uuid> — diff current vs previous (or previous id)
 */
export async function GET(request: Request) {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Snapshots API is not configured." },
        { status: 503 },
      );
    }

    const client = createServiceClient();
    const url = new URL(request.url);
    const wantCurrent = url.searchParams.get("current") === "1";
    const wantHistory = url.searchParams.get("history") === "1";
    const wantDiff = url.searchParams.get("diff") === "1";
    const snapshotId = url.searchParams.get("id");
    const previousId = url.searchParams.get("previous");

    if (wantDiff) {
      const current = await getCurrentAssessmentSnapshot({ client, companyId });
      if (!current?.pack) {
        return NextResponse.json(
          { error: "No current published snapshot pack." },
          { status: 404 },
        );
      }
      let previousPack: AssessmentSnapshotPack | null = null;
      if (previousId) {
        const prev = await getAssessmentSnapshotById({
          client,
          companyId,
          snapshotId: previousId,
        });
        previousPack = prev?.pack ?? null;
      } else if (current.parentSnapshotId) {
        const prev = await getAssessmentSnapshotById({
          client,
          companyId,
          snapshotId: current.parentSnapshotId,
        });
        previousPack = prev?.pack ?? null;
      }

      const diff = diffAssessmentSnapshots({
        current: current.pack,
        previous: previousPack,
      });

      return NextResponse.json({
        current,
        previous: previousPack
          ? { snapshotId: previousPack.snapshotId, pack: previousPack }
          : null,
        diff,
        healthDiff: diff.scoreMovement,
        coverageDiff: diff.coverageMovement,
        provenance: { companyId, userId: ctx.user.id },
      });
    }

    if (snapshotId) {
      const snapshot = await getAssessmentSnapshotById({
        client,
        companyId,
        snapshotId,
      });
      if (!snapshot) {
        return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
      }
      return NextResponse.json({ snapshot });
    }

    if (wantHistory) {
      const snapshots = await listHistoricalAssessmentSnapshots({
        client,
        companyId,
        limit: Number(url.searchParams.get("limit") ?? 20),
      });
      return NextResponse.json({ snapshots });
    }

    // Default / ?current=1
    void wantCurrent;
    const current = await getCurrentAssessmentSnapshot({ client, companyId });
    return NextResponse.json({
      current,
      provenance: { companyId, userId: ctx.user.id },
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
