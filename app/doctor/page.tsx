import { AppShell } from "@/components/AppShell";
import { DoctorChat } from "@/components/doctor/DoctorChat";
import { DoctorHomePanel } from "@/components/doctor/DoctorHomePanel";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";
import { loadDoctorHome } from "@/lib/doctor/conversation/engine";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface DoctorPageProps {
  searchParams: Promise<{
    prompt?: string;
    explain?: string;
  }>;
}

export default async function DoctorPage({ searchParams }: DoctorPageProps) {
  const params = await searchParams;
  const { view, companyName, userName, userEmail, companyId } =
    await loadAuthenticatedDashboardView();

  let initialHome = null;
  if (
    companyId &&
    isSupabaseConfigured() &&
    isServiceRoleConfigured()
  ) {
    try {
      const client = createServiceClient();
      initialHome = await loadDoctorHome({
        client,
        companyId,
        userId: null,
      });
    } catch {
      initialHome = null;
    }
  }

  return (
    <AppShell
      title="Company Doctor"
      subtitle={`CEO mentor · ${view.provenance.document_count.toLocaleString()} documents indexed`}
      flush
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      <DoctorHomePanel initialHome={initialHome} />
      <DoctorChat
        initialPrompt={params.prompt}
        explainRiskId={params.explain}
        documentsAnalyzed={view.provenance.document_count}
        systemsConnected={view.evidenceCatalog.systemsConnected}
      />
    </AppShell>
  );
}
