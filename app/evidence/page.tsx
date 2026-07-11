import { AppShell } from "@/components/AppShell";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { buildEvidenceExplorerRecords } from "@/lib/application/evidence-explorer-model";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";
import type {
  Evidence,
  Finding,
  Recommendation,
  Risk,
} from "@/lib/domain";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  isServiceRoleConfigured,
  listFindings,
  listRecommendations,
  listRisks,
} from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface EvidencePageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const params = await searchParams;
  const { view, companyName, userName, userEmail, companyId } =
    await loadAuthenticatedDashboardView();

  let evidence: Evidence[] = [];
  let findings: Finding[] = [];
  let risks: Risk[] = [];
  let recommendations: Recommendation[] = [];

  if (companyId && isServiceRoleConfigured()) {
    const client = createServiceClient();
    const [ev, f, r, rec] = await Promise.all([
      createEvidenceRepository({ client }).listByCompany(companyId),
      listFindings(client, companyId),
      listRisks(client, companyId),
      listRecommendations(client, companyId),
    ]);
    evidence = ev;
    findings = f;
    risks = r;
    recommendations = rec;
  }

  const records = buildEvidenceExplorerRecords({
    evidence,
    findings,
    risks,
    recommendations,
  });

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
          evidence={evidence}
          findings={findings}
          risks={risks}
          recommendations={recommendations}
        />
      )}
    </AppShell>
  );
}
