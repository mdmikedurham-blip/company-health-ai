"use client";

import { useMemo, useState } from "react";
import {
  buildProvenanceGraph,
  buildProvenanceRecords,
  collectProvenancePath,
  emptyProvenanceFilters,
  filterGraphByKinds,
  recordMatchesFilters,
  type ProvenanceFilters,
  type ProvenanceNodeKind,
  type ProvenanceRecord,
} from "@/lib/application/provenance";
import type {
  Evidence,
  Finding,
  HealthScore,
  Recommendation,
  Risk,
} from "@/lib/domain";
import { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceRecordCard } from "./EvidenceRecordCard";
import { ProvenanceBreadcrumb } from "./ProvenanceBreadcrumb";
import { ProvenanceDetailsPanel } from "./ProvenanceDetailsPanel";
import { VirtualEvidenceList } from "./VirtualEvidenceList";

const DIMENSION_FILTERS = [
  "Financial",
  "Governance",
  "Legal",
  "Security",
  "Customer",
  "People",
] as const;

const NODE_KIND_FILTERS: ProvenanceNodeKind[] = [
  "document",
  "fact",
  "dimension",
  "finding",
  "risk",
  "recommendation",
  "score",
];

interface EvidenceExplorerProps {
  initialSelectedId?: string;
  companyId: string;
  snapshotId: string | null;
  healthScoreId: string | null;
  asOf: string | null;
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  healthScore: HealthScore | null;
  documentStatusById: Record<string, string>;
}

function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function EvidenceExplorer({
  initialSelectedId,
  companyId,
  snapshotId,
  healthScoreId,
  asOf,
  evidence,
  findings,
  risks,
  recommendations,
  healthScore,
  documentStatusById,
}: EvidenceExplorerProps) {
  const statusMap = useMemo(
    () => new Map(Object.entries(documentStatusById)),
    [documentStatusById],
  );

  const baseRecords = useMemo(
    () =>
      buildProvenanceRecords({
        evidence,
        findings,
        risks,
        recommendations,
        scoreExplanations: healthScore?.scoreExplanations ?? [],
        documentStatusById: statusMap,
      }),
    [evidence, findings, risks, recommendations, healthScore, statusMap],
  );

  const [filters, setFilters] = useState<ProvenanceFilters>(() =>
    emptyProvenanceFilters(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (
      initialSelectedId &&
      (baseRecords.some((r) => r.id === initialSelectedId) ||
        findings.some((f) => f.id === initialSelectedId) ||
        risks.some((r) => r.id === initialSelectedId) ||
        recommendations.some((r) => r.id === initialSelectedId))
    ) {
      return initialSelectedId;
    }
    return baseRecords[0]?.id ?? findings[0]?.id ?? null;
  });
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  const [focusDocumentIds, setFocusDocumentIds] = useState<string[]>([]);
  const [expandedRelated, setExpandedRelated] = useState(false);

  const documentTypes = useMemo(() => {
    return [...new Set(baseRecords.map((r) => r.documentType))].sort();
  }, [baseRecords]);

  const statuses = useMemo(() => {
    return [...new Set(baseRecords.map((r) => r.documentStatus))].sort();
  }, [baseRecords]);

  const filteredRecords = useMemo(
    () => baseRecords.filter((r) => recordMatchesFilters(r, filters)),
    [baseRecords, filters],
  );

  const filteredEvidenceIds = useMemo(
    () => new Set(filteredRecords.map((r) => r.id)),
    [filteredRecords],
  );

  const graph = useMemo(() => {
    const scopedEvidence = evidence.filter((e) => filteredEvidenceIds.has(e.id));
    const scopedFindings = findings.filter((f) =>
      f.evidenceIds.some((id) => filteredEvidenceIds.has(id)),
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

    const built = buildProvenanceGraph({
      evidence: scopedEvidence,
      findings: scopedFindings,
      risks: scopedRisks,
      recommendations: scopedRecs,
      healthScore,
      scoreExplanations: healthScore?.scoreExplanations ?? [],
      documentStatusById: statusMap,
      expandedClusterIds: expandedClusters,
      focusDocumentIds: [
        ...focusDocumentIds,
        ...(expandedRelated && selectedId
          ? [selectedId, ...(baseRecords.find((r) => r.id === selectedId)?.linkedFindingIds ?? [])]
          : []),
      ],
      clusterThreshold: expandedRelated ? 500 : 36,
      maxInitialDocuments: expandedRelated ? 120 : 48,
    });

    return filterGraphByKinds(built.nodes, built.edges, filters);
  }, [
    evidence,
    findings,
    risks,
    recommendations,
    healthScore,
    filteredEvidenceIds,
    expandedClusters,
    focusDocumentIds,
    expandedRelated,
    selectedId,
    baseRecords,
    statusMap,
    filters,
  ]);

  const { highlighted, breadcrumb } = useMemo(
    () => collectProvenancePath(selectedId, graph.nodes, graph.edges),
    [selectedId, graph.nodes, graph.edges],
  );

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  const selectedRecord: ProvenanceRecord | null = useMemo(() => {
    if (!selectedId) return null;
    const direct = baseRecords.find((r) => r.id === selectedId);
    if (direct) return direct;
    const viaFinding = baseRecords.find((r) =>
      r.linkedFindingIds.includes(selectedId),
    );
    if (viaFinding) return viaFinding;
    const viaNode = selectedNode?.relatedDocumentIds?.[0];
    return viaNode
      ? (baseRecords.find((r) => r.id === viaNode) ?? null)
      : null;
  }, [selectedId, baseRecords, selectedNode]);

  function onSelectNode(id: string | null) {
    setSelectedId(id);
  }

  function onToggleCluster(clusterId: string) {
    setExpandedClusters((prev) =>
      prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId],
    );
  }

  function expandRelated() {
    setExpandedRelated(true);
    if (selectedNode?.kind === "cluster") {
      onToggleCluster(selectedNode.id);
    }
    if (selectedNode?.relatedDocumentIds?.length) {
      setFocusDocumentIds((prev) => [
        ...new Set([...prev, ...selectedNode.relatedDocumentIds!]),
      ]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          <p>
            Snapshot{" "}
            <span className="font-mono text-zinc-400">
              {snapshotId ?? "none"}
            </span>
            {asOf ? ` · as of ${asOf}` : ""}
            {healthScoreId ? ` · health ${healthScoreId.slice(0, 8)}…` : ""}
          </p>
          <p className="font-mono text-zinc-600">company {companyId.slice(0, 8)}…</p>
        </div>

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
            value={filters.query}
            onChange={(e) =>
              setFilters((f) => ({ ...f, query: e.target.value }))
            }
            placeholder="Search filename, finding, risk, recommendation, or fact…"
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <span className="shrink-0 text-xs text-zinc-600">
            {filteredRecords.length} / {baseRecords.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            Dimension
          </span>
          {DIMENSION_FILTERS.map((dim) => {
            const active = filters.dimensions.has(dim);
            return (
              <button
                key={dim}
                type="button"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    dimensions: toggleSetValue(f.dimensions, dim),
                  }))
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                {dim}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            Node type
          </span>
          {NODE_KIND_FILTERS.map((kind) => {
            const active = filters.nodeKinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    nodeKinds: toggleSetValue(f.nodeKinds, kind),
                  }))
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  active
                    ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                {kind === "score" ? "score" : kind}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              Min confidence · {filters.minConfidence}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={filters.minConfidence}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minConfidence: Number(e.target.value),
                }))
              }
              className="accent-indigo-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              From
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              To
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
              className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
            />
          </label>
          {documentTypes.length > 0 ? (
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Document type
              </span>
              <select
                value={[...filters.documentTypes][0] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((f) => ({
                    ...f,
                    documentTypes: v ? new Set([v]) : new Set(),
                  }));
                }}
                className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
              >
                <option value="">All</option>
                {documentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {statuses.length > 0 ? (
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Status
              </span>
              <select
                value={[...filters.statuses][0] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((f) => ({
                    ...f,
                    statuses: v ? new Set([v]) : new Set(),
                  }));
                }}
                className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
              >
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="border-t border-white/[0.04] pt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
            Selected chain
          </p>
          <ProvenanceBreadcrumb
            nodes={breadcrumb}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {selectedId && highlighted.size > 1 ? (
            <p className="mt-1.5 text-[10px] text-zinc-600">
              Highlighting {highlighted.size} connected nodes upstream &
              downstream
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <VirtualEvidenceList
            className="max-h-[min(72vh,720px)] space-y-0 overflow-y-auto pr-1"
            items={filteredRecords}
            estimateHeight={248}
            renderItem={(record) => (
              <EvidenceRecordCard
                record={record}
                selected={
                  selectedId === record.id ||
                  Boolean(
                    selectedId &&
                      (record.linkedFindingIds.includes(selectedId) ||
                        record.linkedRiskIds.includes(selectedId) ||
                        record.linkedRecommendationIds.includes(selectedId)),
                  )
                }
                onSelect={() => setSelectedId(record.id)}
              />
            )}
          />
          {filteredRecords.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-zinc-500">
                {baseRecords.length === 0
                  ? "No evidence in the current assessment."
                  : "No evidence records match your filters."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="xl:col-span-6">
          <EvidenceGraph
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedId}
            onSelectNode={onSelectNode}
            onToggleCluster={onToggleCluster}
          />
          {!expandedRelated ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={expandRelated}
                className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              >
                Expand related nodes
              </button>
            </div>
          ) : null}
        </div>

        <div className="xl:col-span-3">
          <ProvenanceDetailsPanel
            node={selectedNode}
            record={selectedRecord}
            breadcrumbLabels={breadcrumb.map(
              (n) => `${n.kind}: ${n.label}`,
            )}
            onExpandRelated={expandRelated}
          />
        </div>
      </div>
    </div>
  );
}
