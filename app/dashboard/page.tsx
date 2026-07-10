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
import {
  companyHasManualUploads,
  companyHasPendingUploads,
} from "@/lib/uploads";
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

  let analysisReady = false;
  let analyzing = false;
  let hasUploads = false;
  if (companyId && isServiceRoleConfigured()) {
    try {
      const client = createServiceClient();
      analysisReady = await hasCompletedAnalysis(client, companyId);
      hasUploads = await companyHasManualUploads(client, companyId);
      if (!analysisReady) {
        analyzing = await companyHasPendingUploads(client, companyId);
      }
    } catch {
      analysisReady = false;
    }
  }

  // Also treat existing health_scores as analysis for workspaces that
  // completed sync before analysis_snapshots existed.
  if (!analysisReady && companyId && isServiceRoleConfigured()) {
    try {
      const { data } = await createServiceClient()
        .from("health_scores")
        .select("id")
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle();
      analysisReady = Boolean(data);
    } catch {
      analysisReady = false;
    }
  }

  // New workspaces with no documents yet go straight to upload.
  if (companyId && !analysisReady && !hasUploads && !analyzing) {
    redirect("/upload");
  }

  return (
    <AppShell
      title="Executive Dashboard"
      subtitle={
        analysisReady
          ? executiveBrief.date
          : companyName
            ? `${companyName} · setup`
            : "Setup"
      }
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      {analysisReady ? (
        <DashboardContent />
      ) : (
        <EmptyDashboard
          companyName={companyName}
          analyzing={analyzing}
          hasUploads={hasUploads}
        />
      )}
    </AppShell>
  );
}
