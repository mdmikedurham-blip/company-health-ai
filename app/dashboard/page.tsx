import { AppShell } from "@/components/AppShell";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { EmptyDashboard } from "@/components/dashboard/EmptyDashboard";
import { executiveBrief } from "@/lib/data";
import { getSessionContext } from "@/lib/auth/session";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import { hasCompletedAnalysis } from "@/lib/auth/connector-status";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";
import { computeDashboardProcessingState } from "@/lib/uploads/progress";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboard() {
  const ctx = await getSessionContext();
  const companyName = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.companyName;
  const companyId = ctx?.primaryCompanyId;
  const userName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    ctx?.user.email ??
    null;

  let hasSnapshot = false;
  let hasHealthScore = false;
  let processing = computeDashboardProcessingState({
    hasAnalysisSnapshot: false,
    uploads: [],
  });

  if (companyId && isServiceRoleConfigured()) {
    try {
      const client = createServiceClient();
      hasSnapshot = await hasCompletedAnalysis(client, companyId);

      const { data: uploads } = await client
        .from("documents")
        .select(
          "id, filename, title, status, error_message, updated_at, processing_started_at, lease_expires_at, locked_at",
        )
        .eq("company_id", companyId)
        .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
        .order("created_at", { ascending: false })
        .limit(50);

      processing = computeDashboardProcessingState({
        hasAnalysisSnapshot: hasSnapshot,
        uploads: uploads ?? [],
      });

      const { data: score } = await client
        .from("health_scores")
        .select("id")
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle();
      hasHealthScore = Boolean(score);
    } catch {
      hasSnapshot = false;
    }
  }

  const showLiveDashboard = hasSnapshot || hasHealthScore;
  // Stop spinning when snapshot exists OR every upload is terminal.
  const leaveProcessingState =
    showLiveDashboard || processing.allTerminal || !processing.hasUploads;

  if (
    companyId &&
    !showLiveDashboard &&
    !processing.hasUploads &&
    !processing.inFlight
  ) {
    redirect("/upload");
  }

  return (
    <AppShell
      title="Executive Dashboard"
      subtitle={
        showLiveDashboard
          ? executiveBrief.date
          : companyName
            ? `${companyName} · setup`
            : "Setup"
      }
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      {showLiveDashboard && leaveProcessingState && !processing.inFlight ? (
        <DashboardContent />
      ) : (
        <EmptyDashboard
          companyName={companyName}
          analyzing={processing.inFlight}
          hasUploads={processing.hasUploads}
          stalled={processing.stalled}
          progressItems={processing.items}
          overallLabel={processing.overallLabel}
        />
      )}
    </AppShell>
  );
}
