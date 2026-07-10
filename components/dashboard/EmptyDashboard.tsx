import Link from "next/link";

export function EmptyDashboard({
  companyName,
  analyzing = false,
}: {
  companyName?: string;
  analyzing?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-indigo-300">
        {analyzing ? "Analyzing" : "Waiting for analysis"}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {analyzing
          ? "Building your first health snapshot"
          : companyName
            ? `${companyName} is ready for its first sync`
            : "Connect a source to begin"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        {analyzing
          ? "Your workspace is private. Scores and evidence appear here when analysis completes — no demo data is mixed in."
          : "Your dashboard stays empty until Google Drive finishes its first sync and analysis completes. No demo scores are shown for live workspaces."}
      </p>
      {!analyzing ? (
        <Link
          href="/connectors"
          className="mt-8 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Go to connectors
        </Link>
      ) : (
        <Link
          href="/connectors"
          className="mt-8 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          View connector status →
        </Link>
      )}
    </div>
  );
}
