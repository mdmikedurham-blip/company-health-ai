"use client";

import { PROVENANCE_COLORS, type ProvenanceGraphNode } from "@/lib/application/provenance";

export function ProvenanceBreadcrumb({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: ProvenanceGraphNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!selectedId || nodes.length === 0) {
    return (
      <p className="text-[11px] text-zinc-600">
        Select a node to inspect its provenance path.
      </p>
    );
  }

  return (
    <nav aria-label="Provenance path" className="flex flex-wrap items-center gap-1.5">
      {nodes.map((node, i) => {
        const colors = PROVENANCE_COLORS[node.kind];
        return (
          <span key={node.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="text-[10px] text-zinc-600" aria-hidden>
                →
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="rounded-md border px-2 py-0.5 text-[10px] font-medium transition hover:border-white/30"
              style={{
                borderColor: `${colors.border}55`,
                background: colors.bg,
                color: colors.text,
              }}
              title={node.summary ?? node.label}
            >
              <span className="opacity-70">{colors.label}</span>
              {" · "}
              {node.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
