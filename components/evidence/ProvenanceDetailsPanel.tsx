"use client";

import {
  PROVENANCE_COLORS,
  type ProvenanceGraphNode,
  type ProvenanceRecord,
} from "@/lib/application/provenance";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.04] py-1.5 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-[60%] text-right text-zinc-300">{value}</span>
    </div>
  );
}

export function ProvenanceDetailsPanel({
  node,
  record,
  breadcrumbLabels,
  onExpandRelated,
}: {
  node: ProvenanceGraphNode | null;
  record: ProvenanceRecord | null;
  breadcrumbLabels: string[];
  onExpandRelated?: () => void;
}) {
  if (!node) {
    return (
      <aside className="panel flex h-full min-h-[320px] flex-col justify-center p-5 text-sm text-zinc-500">
        Select a graph node to see why the system believes it.
      </aside>
    );
  }

  const colors = PROVENANCE_COLORS[node.kind];
  const title = record?.documentName ?? node.label;
  const summary =
    record?.aiSummary ?? node.summary ?? "No summary available for this node.";

  return (
    <aside className="panel flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: colors.text }}
        >
          {colors.label}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-zinc-100">{title}</h2>
        {!node.provenanceAvailable ? (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
            Provenance unavailable — no persisted links for this node.
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <p className="text-xs leading-relaxed text-zinc-300">{summary}</p>

        <div>
          <MetaRow label="Type" value={colors.label} />
          {node.confidence != null ? (
            <MetaRow label="Confidence" value={`${node.confidence}%`} />
          ) : null}
          {node.scoreContribution != null ? (
            <MetaRow
              label="Score contribution"
              value={`${node.scoreContribution > 0 ? "+" : ""}${node.scoreContribution} pts`}
            />
          ) : null}
          {node.documentType ? (
            <MetaRow label="Document type" value={node.documentType} />
          ) : null}
          {node.documentStatus ? (
            <MetaRow label="Status" value={node.documentStatus} />
          ) : null}
          {node.timestamps?.collectedAt ? (
            <MetaRow
              label="Processed"
              value={new Date(node.timestamps.collectedAt).toLocaleString()}
            />
          ) : record?.processingDate ? (
            <MetaRow
              label="Processed"
              value={new Date(record.processingDate).toLocaleString()}
            />
          ) : null}
          {node.sourceDocumentId || record ? (
            <MetaRow
              label="Source document"
              value={record?.documentName ?? node.sourceDocumentId ?? "—"}
            />
          ) : null}
        </div>

        {breadcrumbLabels.length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">
              Provenance path
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              {breadcrumbLabels.join(" → ")}
            </p>
          </div>
        ) : null}

        {record ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              Related outcomes
            </p>
            {record.findingsCreated.length > 0 ? (
              <ul className="space-y-1">
                {record.findingsCreated.slice(0, 5).map((t) => (
                  <li key={t} className="truncate text-[11px] text-yellow-300/90">
                    Finding · {t}
                  </li>
                ))}
              </ul>
            ) : null}
            {record.risksCreated.length > 0 ? (
              <ul className="space-y-1">
                {record.risksCreated.slice(0, 5).map((t) => (
                  <li key={t} className="truncate text-[11px] text-red-300/90">
                    Risk · {t}
                  </li>
                ))}
              </ul>
            ) : null}
            {record.recommendationsCreated.length > 0 ? (
              <ul className="space-y-1">
                {record.recommendationsCreated.slice(0, 5).map((t) => (
                  <li key={t} className="truncate text-[11px] text-orange-300/90">
                    Action · {t}
                  </li>
                ))}
              </ul>
            ) : null}
            {record.findingsCreated.length === 0 &&
            record.risksCreated.length === 0 &&
            record.recommendationsCreated.length === 0 ? (
              <p className="text-[11px] text-zinc-600">No linked outcomes.</p>
            ) : null}
          </div>
        ) : null}

        {node.relatedFindingIds && node.relatedFindingIds.length > 0 ? (
          <MetaRow
            label="Related findings"
            value={`${node.relatedFindingIds.length}`}
          />
        ) : null}
        {node.relatedRiskIds && node.relatedRiskIds.length > 0 ? (
          <MetaRow label="Related risks" value={`${node.relatedRiskIds.length}`} />
        ) : null}
        {node.relatedRecommendationIds &&
        node.relatedRecommendationIds.length > 0 ? (
          <MetaRow
            label="Related actions"
            value={`${node.relatedRecommendationIds.length}`}
          />
        ) : null}
      </div>

      {onExpandRelated && (node.kind === "cluster" || (node.memberIds?.length ?? 0) > 1) ? (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={onExpandRelated}
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            Expand related nodes
          </button>
        </div>
      ) : null}
    </aside>
  );
}
