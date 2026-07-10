import Link from "next/link";

export function EmptyDashboard({
  companyName,
  analyzing = false,
  hasUploads = false,
}: {
  companyName?: string;
  analyzing?: boolean;
  hasUploads?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-indigo-300">
        {analyzing
          ? "Processing"
          : hasUploads
            ? "Awaiting analysis"
            : "Waiting for documents"}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {analyzing
          ? "Building your first health snapshot"
          : hasUploads
            ? "Documents are queued for analysis"
            : companyName
              ? `${companyName} is ready for its first upload`
              : "Upload documents to begin"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        {analyzing
          ? "Your workspace is private. Scores and evidence appear here when analysis completes — no demo data is mixed in."
          : hasUploads
            ? "Uploaded files are stored privately and queued for the ingestion pipeline. Your dashboard stays empty until analysis finishes."
            : "Upload PDF, DOCX, PPTX, XLSX, TXT, or CSV files to start. Google Drive sync is optional and coming soon."}
      </p>
      {!analyzing ? (
        <Link
          href="/upload"
          className="mt-8 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Upload documents
        </Link>
      ) : (
        <Link
          href="/upload"
          className="mt-8 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          View uploads →
        </Link>
      )}
    </div>
  );
}
