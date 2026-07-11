"use client";

import { useMemo, useState } from "react";
import type { EvidenceRecordView } from "@/lib/types";
import { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceRecordCard } from "./EvidenceRecordCard";

interface EvidenceExplorerProps {
  /** Deep-link from Company Doctor citations (`/evidence?id=...`). */
  initialSelectedId?: string;
  records: EvidenceRecordView[];
}

export function EvidenceExplorer({
  initialSelectedId,
  records,
}: EvidenceExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (
      initialSelectedId &&
      records.some((r) => r.id === initialSelectedId)
    ) {
      return initialSelectedId;
    }
    return records[0]?.id ?? null;
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.documentName.toLowerCase().includes(q) ||
        r.sourceSystem.toLowerCase().includes(q) ||
        r.dimension.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q),
    );
  }, [query, records]);

  const selectedNodeId = selectedId ?? undefined;
  const nodes = useMemo(
    () =>
      records.map((r, i) => ({
        id: r.id,
        label: r.documentName,
        type: "document" as const,
        x: 80 + (i % 4) * 120,
        y: 80 + Math.floor(i / 4) * 90,
      })),
    [records],
  );

  return (
    <div className="space-y-4">
      <div className="panel flex items-center gap-3 px-4 py-3">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search evidence by document, system, dimension, or keyword..."
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        <span className="shrink-0 text-xs text-zinc-600">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-2">
          {filtered.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-zinc-500">
                {records.length === 0
                  ? "No evidence in the current assessment."
                  : "No evidence records match your search."}
              </p>
            </div>
          ) : (
            filtered.map((record) => (
              <EvidenceRecordCard
                key={record.id}
                record={record}
                selected={selectedId === record.id}
                onSelect={() => setSelectedId(record.id)}
              />
            ))
          )}
        </div>
        <div className="xl:col-span-3">
          <EvidenceGraph
            nodes={nodes}
            edges={[]}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>
    </div>
  );
}
