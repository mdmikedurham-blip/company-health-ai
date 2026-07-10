import Link from "next/link";
import type { ConnectorSummary } from "@/lib/domain";

interface EvidenceCardProps {
  totalDocuments: number;
  systemsConnected: number;
  lastFullScan: string;
  sources: ConnectorSummary[];
}

export function EvidenceCard({
  totalDocuments,
  systemsConnected,
  lastFullScan,
  sources,
}: EvidenceCardProps) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Evidence Summary
          </p>
          <p className="mt-1 text-xs text-zinc-600">Last full scan · {lastFullScan}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{totalDocuments.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-500">documents analyzed</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5"
          >
            <p className="text-xs font-medium text-zinc-300">{source.name}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {source.documentsAnalyzed}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Synced {source.lastSynced}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <p className="text-xs text-zinc-500">
          {systemsConnected} systems connected · read-only access
        </p>
          <Link
            href="/evidence"
            className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            View all evidence →
          </Link>
      </div>
    </div>
  );
}
