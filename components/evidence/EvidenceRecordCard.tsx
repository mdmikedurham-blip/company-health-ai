import type { EvidenceRecordView } from "@/lib/types";

interface EvidenceRecordCardProps {
  record: EvidenceRecordView;
  selected?: boolean;
  onSelect?: () => void;
}

const systemColors: Record<string, string> = {
  HubSpot: "#FF7A59",
  Box: "#0061D5",
  Carta: "#5B4FCF",
  QuickBooks: "#2CA01C",
  "Google Drive": "#4285F4",
};

export function EvidenceRecordCard({ record, selected, onSelect }: EvidenceRecordCardProps) {
  const color = systemColors[record.sourceSystem] ?? "#6366f1";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? "border-indigo-500/40 bg-indigo-500/10"
          : "border-[var(--border)] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {record.sourceSystem.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">{record.documentName}</p>
            <p className="text-[11px] text-zinc-500">{record.sourceSystem}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-emerald-400">{record.confidence}%</p>
          <p className="text-[10px] text-zinc-600">confidence</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{record.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
          {record.dimension}
        </span>
        <span className="text-[10px] text-zinc-600">Reviewed {record.lastReviewed}</span>
      </div>
      {record.linkedRisks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {record.linkedRisks.map((risk) => (
            <span
              key={risk}
              className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400"
            >
              {risk}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
