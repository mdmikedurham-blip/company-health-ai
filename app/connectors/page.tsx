import { AppShell } from "@/components/AppShell";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { AccountDangerZone } from "@/components/AccountDangerZone";

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

  return (
    <AppShell
      title="Connectors"
      subtitle="Connect systems to power company health analysis"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Data sources</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Google Drive is available now. Tokens stay encrypted on the server
            and are never sent to the browser.
          </p>
        </div>

        <GoogleDriveConnect
          oauthResult={oauthResult}
          oauthReason={oauthReason}
        />

        <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
          <p className="text-sm text-zinc-400">More connectors coming soon</p>
          <p className="mt-1 text-xs text-zinc-600">
            HubSpot, Carta, QuickBooks, Slack, and BambooHR
          </p>
        </div>

        <AccountDangerZone />
      </div>
    </AppShell>
  );
}
