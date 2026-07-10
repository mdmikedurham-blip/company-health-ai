import { AppShell } from "@/components/AppShell";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getSessionContext();
  const companyName = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.companyName;
  const userName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    ctx?.user.email ??
    null;

  return (
    <AppShell
      title="Reports"
      subtitle="Scheduled and exportable health reports"
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Reports coming soon
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Exportable board packs and recurring health digests will appear here
          once your workspace has completed its first analysis.
        </p>
      </div>
    </AppShell>
  );
}
