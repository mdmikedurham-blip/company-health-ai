/**
 * Deterministic Dagre layout for provenance graphs (LR).
 * Memoizable by structural key; selection must not re-run layout.
 */

import dagre from "dagre";
import type { ProvenanceGraphEdge, ProvenanceGraphNode, ProvenanceNodeKind } from "./types";

const NODE_SIZE: Record<ProvenanceNodeKind, { w: number; h: number }> = {
  document: { w: 172, h: 54 },
  cluster: { w: 180, h: 58 },
  fact: { w: 148, h: 50 },
  dimension: { w: 144, h: 46 },
  finding: { w: 172, h: 54 },
  risk: { w: 164, h: 54 },
  recommendation: { w: 172, h: 54 },
  score: { w: 140, h: 50 },
};

const RANK: Record<ProvenanceNodeKind, number> = {
  cluster: 0,
  document: 0,
  fact: 1,
  dimension: 2,
  finding: 3,
  risk: 4,
  recommendation: 5,
  score: 6,
};

export type LaidOutProvenanceNode = ProvenanceGraphNode & { x: number; y: number };

export type ProvenanceLayoutResult = {
  nodes: LaidOutProvenanceNode[];
  edges: ProvenanceGraphEdge[];
  width: number;
  height: number;
};

const layoutCache = new Map<string, ProvenanceLayoutResult>();
const MAX_CACHE = 24;

export function provenanceLayoutKey(
  nodes: ProvenanceGraphNode[],
  edges: ProvenanceGraphEdge[],
): string {
  const n = nodes
    .map((node) => node.id)
    .sort()
    .join("|");
  const e = edges
    .map((edge) => edge.id)
    .sort()
    .join("|");
  return `${nodes.length}:${edges.length}:${n.length}:${e.length}:${n.slice(0, 120)}:${e.slice(0, 120)}`;
}

export function nodeSize(kind: ProvenanceNodeKind) {
  return NODE_SIZE[kind];
}

export function layoutProvenanceGraph(
  nodes: ProvenanceGraphNode[],
  edges: ProvenanceGraphEdge[],
  options?: { skipCache?: boolean },
): ProvenanceLayoutResult {
  const key = provenanceLayoutKey(nodes, edges);
  if (!options?.skipCache) {
    const cached = layoutCache.get(key);
    if (cached) return cached;
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 40,
    ranksep: 78,
    marginx: 28,
    marginy: 28,
    align: "UL",
  });

  for (const node of nodes) {
    const size = NODE_SIZE[node.kind];
    g.setNode(node.id, {
      width: size.w,
      height: size.h,
      rank: RANK[node.kind],
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  let maxX = 0;
  let maxY = 0;
  const laidOut: LaidOutProvenanceNode[] = nodes.map((node) => {
    const pos = g.node(node.id);
    const size = NODE_SIZE[node.kind];
    const x = (pos?.x ?? 0) - size.w / 2;
    const y = (pos?.y ?? 0) - size.h / 2;
    maxX = Math.max(maxX, x + size.w);
    maxY = Math.max(maxY, y + size.h);
    return { ...node, x, y };
  });

  // Deterministic collision nudge within rank.
  const byRank = new Map<number, LaidOutProvenanceNode[]>();
  for (const n of laidOut) {
    const r = RANK[n.kind];
    const list = byRank.get(r) ?? [];
    list.push(n);
    byRank.set(r, list);
  }
  for (const [, group] of byRank) {
    group.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]!;
      const cur = group[i]!;
      const gap = 14;
      const minY = prev.y + NODE_SIZE[prev.kind].h + gap;
      if (cur.y < minY) cur.y = minY;
      maxY = Math.max(maxY, cur.y + NODE_SIZE[cur.kind].h);
    }
  }

  const result: ProvenanceLayoutResult = {
    nodes: laidOut,
    edges,
    width: Math.max(640, maxX + 48),
    height: Math.max(400, maxY + 48),
  };

  if (!options?.skipCache) {
    if (layoutCache.size >= MAX_CACHE) {
      const first = layoutCache.keys().next().value;
      if (first) layoutCache.delete(first);
    }
    layoutCache.set(key, result);
  }

  return result;
}

/** True when any two same-rank nodes overlap AABB (after layout). */
export function hasOverlappingNodes(laid: LaidOutProvenanceNode[]): boolean {
  for (let i = 0; i < laid.length; i++) {
    const a = laid[i]!;
    const as = NODE_SIZE[a.kind];
    for (let j = i + 1; j < laid.length; j++) {
      const b = laid[j]!;
      const bs = NODE_SIZE[b.kind];
      const overlapX = a.x < b.x + bs.w && a.x + as.w > b.x;
      const overlapY = a.y < b.y + bs.h && a.y + as.h > b.y;
      if (overlapX && overlapY) return true;
    }
  }
  return false;
}

export function clearProvenanceLayoutCache() {
  layoutCache.clear();
}
