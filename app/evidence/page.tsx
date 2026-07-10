import { AppShell } from "@/components/AppShell";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { evidenceCatalog } from "@/lib/data";

export default function EvidencePage() {
  return (
    <AppShell
      title="Evidence Explorer"
      subtitle={`${evidenceCatalog.totalDocuments.toLocaleString()} documents · ${evidenceCatalog.systemsConnected} systems connected`}
    >
      <EvidenceExplorer />
    </AppShell>
  );
}
