"use client";

import { useMemo, useState } from "react";
import {
  buildEvidenceExplorerGraph,
  filterMatchesDimension,
  type EvidenceExplorerFilterDimension,
  type EvidenceExplorerRecord,
  type ExplorerGraphEdge,
  type ExplorerGraphNode,
} from "@/lib/application/evidence-explorer-model";
import type { Evidence, Finding, Recommendation, Risk } from "@/lib/domain";
import { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceRecordCard } from "./EvidenceRecordCard";

const DIMENSION_FILTERS: EvidenceExplorerFilterDimension[] = [
  "Financial",
  "Governance",
  "Legal",
  "Security",
  "Customer",
  "People",
];

interface EvidenceExplorerProps {
  initialSelectedId?: string;
  records: EvidenceExplorerRecord[];
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
}

export function EvidenceExplorer({
  initialSelectedId,
  records,
  evidence,
  findings,
  risks,
  recommendations,
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
  const [dimensionFilters, setDimensionFilters] = useState<
    Set<EvidenceExplorerFilterDimension>
  >(new Set());
  const [minConfidence, setMinConfidence] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);

  const filteredRecords = useMemo(() => {
    const q = query.toLowerCase().trim();
    return records.filter((r) => {
      if (r.confidence < minConfidence) return false;
      if (dimensionFilters.size > 0) {
        const ok = [...dimensionFilters].some((f) =>
          filterMatchesDimension(r, f),
        );
        if (!ok) return false;
      }
      if (dateFrom) {
        const t = Date.parse(r.processingDate);
        const from = Date.parse(dateFrom);
        if (!Number.isNaN(t) && !Number.isNaN(from) && t < from) return false;
      }
      if (dateTo) {
        const t = Date.parse(r.processingDate);
        const to = Date.parse(dateTo) + 86_400_000;
        if (!Number.isNaN(t) && !Number.isNaN(to) && t > to) return false;
      }
      if (!q) return true;
      return (
        r.documentName.toLowerCase().includes(q) ||
        r.sourceSystem.toLowerCase().includes(q) ||
        r.documentType.toLowerCase().includes(q) ||
        r.aiSummary.toLowerCase().includes(q) ||
        r.dimensions.some((d) => d.toLowerCase().includes(q)) ||
        r.findingsCreated.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [records, query, minConfidence, dimensionFilters, dateFrom, dateTo]);

  const filteredEvidenceIds = useMemo(
    () => new Set(filteredRecords.map((r) => r.id)),
    [filteredRecords],
  );

  const graph = useMemo(() => {
    const scopedEvidence = evidence.filter((e) => filteredEvidenceIds.has(e.id));
    const scopedFindings = findings.filter(
      (f) =>
        f.evidenceIds.some((id) => filteredEvidenceIds.has(id)) ||
        scopedEvidence.length === 0,
    );
    const findingIds = new Set(scopedFindings.map((f) => f.id));
    const scopedRisks = risks.filter(
      (r) =>
        r.evidenceIds.some((id) => filteredEvidenceIds.has(id)) ||
        r.findingIds.some((id) => findingIds.has(id)),
    );
    const riskIds = new Set(scopedRisks.map((r) => r.id));
    const scopedRecs = recommendations.filter(
      (rec) =>
        rec.evidenceIds.some((id) => filteredEvidenceIds.has(id)) ||
        rec.findingIds.some((id) => findingIds.has(id)) ||
        rec.riskIds.some((id) => riskIds.has(id)),
    );

    return buildEvidenceExplorerGraph({
      evidence: scopedEvidence,
      findings: scopedFindings,
      risks: scopedRisks,
      recommendations: scopedRecs,
      expandedClusterIds: expandedClusters,
      clusterThreshold: 36,
    });
  }, [
    evidence,
    findings,
    risks,
    recommendations,
    filteredEvidenceIds,
    expandedClusters,
  ]);

  function toggleDimension(filter: EvidenceExplorerFilterDimension) {
    setDimensionFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  function onSelectNode(id: string | null) {
    if (!id) {
      setSelectedId(null);
      return;
    }
    // Selecting a finding/risk/etc. keeps graph highlight; list selection only for docs.
    if (records.some((r) => r.id === id) || id.startsWith("cluster:")) {
      setSelectedId(id);
      return;
    }
    setSelectedId(id);
  }

  function onToggleCluster(clusterId: string) {
    setExpandedClusters((prev) =>
      prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId],
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-zinc-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, dimensions, findings…"
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <span className="shrink-0 text-xs text-zinc-600">
            {filteredRecords.length} / {records.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DIMENSION_FILTERS.map((filter) => {
            const active = dimensionFilters.has(filter);
            return (
              <button
                key={filter}
                type="button"
                onClick={() => toggleDimension(filter)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              Min confidence · {minConfidence}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="accent-indigo-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="max-h-[min(72vh,720px)] space-y-3 overflow-y-auto pr-1 xl:col-span-2">
          {filteredRecords.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-zinc-500">
                {records.length === 0
                  ? "No evidence in the current assessment."
                  : "No evidence records match your filters."}
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <EvidenceRecordCard
                key={record.id}
                record={record}
                selected={
                  selectedId === record.id ||
                  Boolean(
                    selectedId &&
                      record.linkedFindingIds.includes(selectedId),
                  ) ||
                  Boolean(
                    selectedId && record.linkedRiskIds.includes(selectedId),
                  )
                }
                onSelect={() => setSelectedId(record.id)}
              />
            ))
          )}
        </div>
        <div className="xl:col-span-3">
          <EvidenceGraph
            nodes={graph.nodes as ExplorerGraphNode[]}
            edges={graph.edges as ExplorerGraphEdge[]}
            selectedNodeId={selectedId}
            onSelectNode={onSelectNode}
            onToggleCluster={onToggleCluster}
          />
        </div>
      </div>
    </div>
  );
}
