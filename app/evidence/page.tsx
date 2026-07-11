import { AppShell } from "@/components/AppShell";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";
import type {
  Evidence,
  Finding,
  HealthScore,
  Recommendation,
  Risk,
} from "@/lib/domain";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  getLatestHealthScore,
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

/**
 * Evidence Explorer — provenance / trust hub.
 * Authenticated production path only: tenant-scoped, one snapshot, no demo fallback.
 */
export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const params = await searchParams;
  const { view, companyName, userName, userEmail, companyId } =
    await loadAuthenticatedDashboardView();

  let evidence: Evidence[] = [];
  let findings: Finding[] = [];
  let risks: Risk[] = [];
  let recommendations: Recommendation[] = [];
  let healthScore: HealthScore | null = null;
  let healthScoreId: string | null = null;
  let documentStatusById: Record<string, string> = {};

  const snapshotId = view.provenance.snapshot_id;
  const asOf = view.provenance.generated_at;

  if (companyId && isServiceRoleConfigured()) {
    const client = createServiceClient();
    const [ev, f, r, rec, latest, docs, hsMeta] = await Promise.all([
      createEvidenceRepository({ client }).listByCompany(companyId),
      listFindings(client, companyId),
      listRisks(client, companyId),
      listRecommendations(client, companyId),
      getLatestHealthScore(client, companyId),
      client
        .from("documents")
        .select("id, status")
        .eq("company_id", companyId),
      client
        .from("health_scores")
        .select("id")
        .eq("company_id", companyId)
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    evidence = ev;
    findings = f;
    risks = r;
    recommendations = rec;
    healthScore = latest?.healthScore ?? null;
    if (hsMeta.error) {
      throw new Error(`evidence.health_scores: ${hsMeta.error.message}`);
    }
    healthScoreId = hsMeta.data?.id ?? null;

    if (docs.error) {
      throw new Error(`evidence.documents: ${docs.error.message}`);
    }
    documentStatusById = Object.fromEntries(
      (docs.data ?? []).map((d) => [d.id, d.status]),
    );
  }

  const empty =
    view.provenance.source === "empty_state" && evidence.length === 0;

  return (
    <AppShell
      title="Evidence Explorer"
      subtitle={`Why does the AI believe this? · ${view.provenance.document_count.toLocaleString()} documents · snapshot ${snapshotId ?? "none"}`}
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      {empty ? (
        <div className="panel p-8 text-center text-sm text-zinc-500">
          No evidence yet.{" "}
          <Link href="/upload" className="text-indigo-400">
            Upload documents →
          </Link>
        </div>
      ) : !companyId ? (
        <div className="panel p-8 text-center text-sm text-zinc-500">
          Sign in with a company account to inspect provenance. This page only
          loads tenant-scoped persisted analysis.
        </div>
      ) : (
        <EvidenceExplorer
          initialSelectedId={params.id}
          companyId={companyId}
          snapshotId={snapshotId}
          healthScoreId={healthScoreId}
          asOf={asOf}
          evidence={evidence}
          findings={findings}
          risks={risks}
          recommendations={recommendations}
          healthScore={healthScore}
          documentStatusById={documentStatusById}
        />
      )}
    </AppShell>
  );
}
