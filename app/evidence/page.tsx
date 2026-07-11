import { AppShell } from "@/components/AppShell";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import type { EvidenceRecordView } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface EvidencePageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const params = await searchParams;
  const { view, companyName, userName, userEmail, companyId } =
    await loadAuthenticatedDashboardView();

  let records: EvidenceRecordView[] = [];
  if (companyId && isServiceRoleConfigured()) {
    const client = createServiceClient();
    const evidence = await createEvidenceRepository({ client }).listByCompany(
      companyId,
    );
    records = evidence.map((item) => ({
      id: item.id,
      sourceSystem: item.sourceSystem,
      documentName: item.title,
      confidence: item.reliability,
      dimension: item.dimension,
      lastReviewed: item.collectedAt,
      summary: item.contentSummary,
      linkedRisks: [],
      linkedInsights: [],
    }));
  }

  return (
    <AppShell
      title="Evidence Explorer"
      subtitle={`${view.provenance.document_count.toLocaleString()} documents · ${view.evidenceCatalog.systemsConnected} systems connected`}
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      {view.provenance.source === "empty_state" && records.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-zinc-500">
          No evidence yet.{" "}
          <Link href="/upload" className="text-indigo-400">
            Upload documents →
          </Link>
        </div>
      ) : (
        <EvidenceExplorer
          initialSelectedId={params.id}
          records={records}
        />
      )}
    </AppShell>
  );
}
