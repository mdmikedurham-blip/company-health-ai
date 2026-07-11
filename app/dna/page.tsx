import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/**
 * Company DNA for authenticated tenants — no Acme seed fallback.
 * Profile fields are not yet persisted per-tenant; show truthful empty state.
 */
export default async function CompanyDNAPage() {
  const { view, companyName, userName, userEmail } =
    await loadAuthenticatedDashboardView();

  return (
    <AppShell
      title="Company DNA"
      subtitle={`Living profile · ${companyName ?? "Your company"}`}
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      <div className="panel p-8 text-center">
        <p className="text-sm text-zinc-400">
          Company DNA is built from your uploaded evidence
          {view.provenance.document_count > 0
            ? ` (${view.provenance.document_count} processed documents)`
            : ""}
          . A full profile editor is not enabled yet — this page no longer
          shows demo Acme data.
        </p>
        <Link
          href="/upload"
          className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300"
        >
          Upload documents →
        </Link>
      </div>
    </AppShell>
  );
}
