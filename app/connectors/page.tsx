import { AppShell } from "@/components/AppShell";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { getSessionContext } from "@/lib/auth/session";
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
      title="Connectors"
      subtitle="Optional data sources — upload is the primary path"
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">
                Manual document upload
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                First-class ingestion for PDF, DOCX, PPTX, XLSX, TXT, and CSV.
              </p>
            </div>
            <Link
              href="/upload"
              className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 transition hover:bg-white"
            >
              Go to upload
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-200">
            Optional connectors
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Cloud connectors are secondary. Google Drive remains in the product
            but is not required for onboarding.
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
      </div>
    </AppShell>
  );
}
