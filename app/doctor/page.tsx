import { AppShell } from "@/components/AppShell";
import { DoctorChat } from "@/components/doctor/DoctorChat";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

interface DoctorPageProps {
  searchParams: Promise<{
    prompt?: string;
    explain?: string;
  }>;
}

export default async function DoctorPage({ searchParams }: DoctorPageProps) {
  const params = await searchParams;
  const { view, companyName, userName, userEmail } =
    await loadAuthenticatedDashboardView();

  return (
    <AppShell
      title="Company Doctor"
      subtitle={`AI health analyst · ${view.provenance.document_count.toLocaleString()} documents indexed`}
      flush
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      <DoctorChat
        initialPrompt={params.prompt}
        explainRiskId={params.explain}
        documentsAnalyzed={view.provenance.document_count}
        systemsConnected={view.evidenceCatalog.systemsConnected}
      />
    </AppShell>
  );
}
