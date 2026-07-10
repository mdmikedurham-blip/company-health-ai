import { AppShell } from "@/components/AppShell";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { getSessionContext } from "@/lib/auth/session";
import { MANUAL_UPLOAD_FORMAT_LABELS } from "@/lib/uploads/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const oauthResult =
    typeof params.gdrive === "string" ? params.gdrive : null;
  const oauthReason =
    typeof params.reason === "string" ? params.reason : null;
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
      title="Data sources"
      subtitle="Upload documents to power company health analysis"
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      <div className="mx-auto max-w-2xl space-y-8">
        <section className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300">
            Primary path
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Upload documents
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
            Add PDF, DOCX, PPTX, XLSX, TXT, or CSV files to your private company
            workspace. This is how new companies start analysis.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {MANUAL_UPLOAD_FORMAT_LABELS.join(" · ")}
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
          >
            Upload Documents
          </Link>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Coming soon</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Optional connectors are not part of onboarding. Use Upload
              Documents above.
            </p>
          </div>

          <GoogleDriveConnect
            comingSoon
            oauthResult={oauthResult}
            oauthReason={oauthReason}
          />

          <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
            <p className="text-sm text-zinc-400">More connectors coming soon</p>
            <p className="mt-1 text-xs text-zinc-600">
              HubSpot, Carta, QuickBooks, Slack, and BambooHR
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
