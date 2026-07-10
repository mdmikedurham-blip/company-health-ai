import { AppShell } from "@/components/AppShell";
import { DocumentUploadPanel } from "@/components/uploads/DocumentUploadPanel";
import { getSessionContext } from "@/lib/auth/session";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import { listManualUploads } from "@/lib/uploads";
import { MANUAL_UPLOAD_FORMAT_LABELS } from "@/lib/uploads/constants";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const ctx = await getSessionContext();
  const companyName = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.companyName;
  const userName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    ctx?.user.email ??
    null;

  let initialDocuments: Awaited<ReturnType<typeof listManualUploads>> = [];
  if (ctx?.primaryCompanyId && isServiceRoleConfigured()) {
    try {
      initialDocuments = await listManualUploads({
        client: createServiceClient(),
        companyId: ctx.primaryCompanyId,
        limit: 50,
      });
    } catch {
      initialDocuments = [];
    }
  }

  return (
    <AppShell
      title="Upload documents"
      subtitle={
        companyName
          ? `${companyName} · ${MANUAL_UPLOAD_FORMAT_LABELS.join(", ")}`
          : "Add source documents for analysis"
      }
      userName={userName}
      companyName={companyName}
      userEmail={ctx?.user.email ?? null}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-zinc-500">
          Upload files to private company storage. Files are queued for the
          ingestion pipeline after upload — analysis does not run during the
          upload itself.
        </p>
        <DocumentUploadPanel initialDocuments={initialDocuments} />
      </div>
    </AppShell>
  );
}
