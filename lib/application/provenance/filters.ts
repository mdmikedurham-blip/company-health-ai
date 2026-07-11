/**
 * Provenance hub filter helpers.
 */

import type { ProvenanceFilters, ProvenanceGraphEdge, ProvenanceGraphNode, ProvenanceRecord } from "./types";

export function emptyProvenanceFilters(): ProvenanceFilters {
  return {
    query: "",
    dimensions: new Set(),
    nodeKinds: new Set(),
    minConfidence: 0,
    dateFrom: "",
    dateTo: "",
    documentTypes: new Set(),
    statuses: new Set(),
  };
}

export function recordMatchesFilters(
  record: ProvenanceRecord,
  filters: ProvenanceFilters,
): boolean {
  if (record.confidence < filters.minConfidence) return false;

  if (filters.dimensions.size > 0) {
    const ok = record.dimensions.some((d) => filters.dimensions.has(d));
    if (!ok) return false;
  }

  if (filters.documentTypes.size > 0) {
    if (!filters.documentTypes.has(record.documentType)) return false;
  }

  if (filters.statuses.size > 0) {
    if (!filters.statuses.has(record.documentStatus)) return false;
  }

  if (filters.dateFrom) {
    const t = Date.parse(record.processingDate);
    const from = Date.parse(filters.dateFrom);
    if (!Number.isNaN(t) && !Number.isNaN(from) && t < from) return false;
  }
  if (filters.dateTo) {
    const t = Date.parse(record.processingDate);
    const to = Date.parse(filters.dateTo) + 86_400_000;
    if (!Number.isNaN(t) && !Number.isNaN(to) && t > to) return false;
  }

  const q = filters.query.toLowerCase().trim();
  if (!q) return true;

  return (
    record.documentName.toLowerCase().includes(q) ||
    record.documentType.toLowerCase().includes(q) ||
    record.sourceSystem.toLowerCase().includes(q) ||
    record.aiSummary.toLowerCase().includes(q) ||
    record.dimensions.some((d) => d.toLowerCase().includes(q)) ||
    record.findingsCreated.some((f) => f.toLowerCase().includes(q)) ||
    record.risksCreated.some((r) => r.toLowerCase().includes(q)) ||
    record.recommendationsCreated.some((r) => r.toLowerCase().includes(q)) ||
    record.rawExtract.toLowerCase().includes(q)
  );
}

export function nodeMatchesKindFilter(
  node: ProvenanceGraphNode,
  filters: ProvenanceFilters,
): boolean {
  if (filters.nodeKinds.size === 0) return true;
  if (node.kind === "cluster") return filters.nodeKinds.has("document");
  return filters.nodeKinds.has(node.kind);
}

export function filterGraphByKinds(
  nodes: ProvenanceGraphNode[],
  edges: ProvenanceGraphEdge[],
  filters: ProvenanceFilters,
): { nodes: ProvenanceGraphNode[]; edges: ProvenanceGraphEdge[] } {
  if (filters.nodeKinds.size === 0) return { nodes, edges };
  const keep = new Set(
    nodes.filter((n) => nodeMatchesKindFilter(n, filters)).map((n) => n.id),
  );
  const nextNodes = nodes.filter((n) => keep.has(n.id));
  const nextEdges = edges.filter(
    (e) => keep.has(e.source) && keep.has(e.target),
  );
  return { nodes: nextNodes, edges: nextEdges };
}
