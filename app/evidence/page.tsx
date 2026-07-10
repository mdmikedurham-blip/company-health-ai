import { AppShell } from "@/components/AppShell";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { evidenceCatalog } from "@/lib/data";

interface EvidencePageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const params = await searchParams;

  return (
    <AppShell
      title="Evidence Explorer"
      subtitle={`${evidenceCatalog.totalDocuments.toLocaleString()} documents · ${evidenceCatalog.systemsConnected} systems connected`}
    >
      <EvidenceExplorer initialSelectedId={params.id} />
    </AppShell>
  );
}
