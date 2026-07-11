import { AppShell } from "@/components/AppShell";
import { HealthDimensionsGrid } from "@/components/health/HealthDimensionsGrid";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const { view, companyName, userName, userEmail } =
    await loadAuthenticatedDashboardView();
  const { dimensions, healthScore } = view;

  return (
    <AppShell
      title="Health Dimensions"
      subtitle={`${dimensions.length} dimensions · Overall score ${healthScore.score}`}
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      {view.provenance.source === "empty_state" ? (
        <div className="panel p-8 text-center text-sm text-zinc-500">
          No persisted health scores yet.{" "}
          <Link href="/upload" className="text-indigo-400">
            Upload documents →
          </Link>
        </div>
      ) : (
        <HealthDimensionsGrid dimensions={dimensions} />
      )}
    </AppShell>
  );
}
