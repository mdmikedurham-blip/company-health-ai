import { AppShell } from "@/components/AppShell";
import { AccountDangerZone } from "@/components/AccountDangerZone";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  const companyName = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.companyName;
  const role = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.role;
  const userName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    ctx?.user.email ??
    null;

  return (
    <AppShell
      title="Settings"
      subtitle="Account, workspace, and access controls"
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium text-zinc-200">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Name</dt>
              <dd className="text-zinc-200">{userName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Email</dt>
              <dd className="text-zinc-200">{ctx?.user.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Workspace</dt>
              <dd className="text-zinc-200">{companyName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Role</dt>
              <dd className="capitalize text-zinc-200">{role ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <AccountDangerZone
          showDeleteCompany={role === "owner"}
          companyName={companyName}
        />
      </div>
    </AppShell>
  );
}
