import { AppShell } from "@/components/AppShell";
import { CompanyProfilePanel } from "@/components/uploads/CompanyProfilePanel";
import { DocumentUploadPanel } from "@/components/uploads/DocumentUploadPanel";
import { WhatToUploadNextPanel } from "@/components/uploads/WhatToUploadNextPanel";
import { getSessionContext } from "@/lib/auth/session";
import { getCompanyClassification } from "@/lib/classification/persist";
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
  let classification = null as Awaited<
    ReturnType<typeof getCompanyClassification>
  >;
  if (ctx?.primaryCompanyId && isServiceRoleConfigured()) {
    try {
      const client = createServiceClient();
      const [docs, profile] = await Promise.all([
        listManualUploads({
          client,
          companyId: ctx.primaryCompanyId,
          limit: 50,
        }),
        getCompanyClassification(client, ctx.primaryCompanyId),
      ]);
      initialDocuments = docs;
      classification = profile;
    } catch {
      initialDocuments = [];
      classification = null;
    }
  }

  const classifying = !classification || !classification.stage;

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
        <CompanyProfilePanel
          classification={classification}
          classifying={classifying}
        />
        <WhatToUploadNextPanel
          classification={classification}
          classifying={classifying}
        />
        <DocumentUploadPanel initialDocuments={initialDocuments} />
      </div>
    </AppShell>
  );
}
