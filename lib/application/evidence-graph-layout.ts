/**
 * Dagre layered layout for Evidence Explorer (LR).
 * Layers: document/cluster → fact → dimension → finding → risk → recommendation
 */

import dagre from "dagre";
import type { ExplorerGraphEdge, ExplorerGraphNode } from "./evidence-explorer-model";

const NODE_W: Record<ExplorerGraphNode["kind"], { w: number; h: number }> = {
  document: { w: 168, h: 52 },
  cluster: { w: 176, h: 56 },
  fact: { w: 140, h: 48 },
  dimension: { w: 140, h: 44 },
  finding: { w: 168, h: 52 },
  risk: { w: 160, h: 52 },
  recommendation: { w: 168, h: 52 },
};

const RANK: Record<ExplorerGraphNode["kind"], number> = {
  cluster: 0,
  document: 0,
  fact: 1,
  dimension: 2,
  finding: 3,
  risk: 4,
  recommendation: 5,
};

export type LaidOutNode = ExplorerGraphNode & { x: number; y: number };

export function layoutEvidenceExplorerGraph(
  nodes: ExplorerGraphNode[],
  edges: ExplorerGraphEdge[],
): { nodes: LaidOutNode[]; edges: ExplorerGraphEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 36,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
    align: "UL",
  });

  for (const node of nodes) {
    const size = NODE_W[node.kind];
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
  const laidOut: LaidOutNode[] = nodes.map((node) => {
    const pos = g.node(node.id);
    const size = NODE_W[node.kind];
    const x = (pos?.x ?? 0) - size.w / 2;
    const y = (pos?.y ?? 0) - size.h / 2;
    maxX = Math.max(maxX, x + size.w);
    maxY = Math.max(maxY, y + size.h);
    return { ...node, x, y };
  });

  // Collision nudge within the same rank (safety net if dagre packs tightly).
  const byRank = new Map<number, LaidOutNode[]>();
  for (const n of laidOut) {
    const r = RANK[n.kind];
    const list = byRank.get(r) ?? [];
    list.push(n);
    byRank.set(r, list);
  }
  for (const [, group] of byRank) {
    group.sort((a, b) => a.y - b.y);
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]!;
      const cur = group[i]!;
      const prevH = NODE_W[prev.kind].h;
      const gap = 12;
      const minY = prev.y + prevH + gap;
      if (cur.y < minY) cur.y = minY;
      maxY = Math.max(maxY, cur.y + NODE_W[cur.kind].h);
    }
  }

  return {
    nodes: laidOut,
    edges,
    width: Math.max(640, maxX + 40),
    height: Math.max(400, maxY + 40),
  };
}

export function nodeSize(kind: ExplorerGraphNode["kind"]) {
  return NODE_W[kind];
}
