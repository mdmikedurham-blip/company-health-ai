"use client";

import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  collectHighlightIds,
  type ExplorerGraphEdge,
  type ExplorerGraphNode,
  type ExplorerNodeKind,
} from "@/lib/application/evidence-explorer-model";
import {
  layoutEvidenceExplorerGraph,
  nodeSize,
} from "@/lib/application/evidence-graph-layout";

const KIND_STYLE: Record<
  ExplorerNodeKind,
  { bg: string; border: string; text: string; minimap: string }
> = {
  document: {
    bg: "rgba(59,130,246,0.18)",
    border: "#3b82f6",
    text: "#93c5fd",
    minimap: "#3b82f6",
  },
  cluster: {
    bg: "rgba(59,130,246,0.28)",
    border: "#60a5fa",
    text: "#bfdbfe",
    minimap: "#60a5fa",
  },
  fact: {
    bg: "rgba(14,165,233,0.14)",
    border: "#0ea5e9",
    text: "#7dd3fc",
    minimap: "#0ea5e9",
  },
  dimension: {
    bg: "rgba(34,197,94,0.16)",
    border: "#22c55e",
    text: "#86efac",
    minimap: "#22c55e",
  },
  finding: {
    bg: "rgba(234,179,8,0.16)",
    border: "#eab308",
    text: "#fde047",
    minimap: "#eab308",
  },
  risk: {
    bg: "rgba(239,68,68,0.16)",
    border: "#ef4444",
    text: "#fca5a5",
    minimap: "#ef4444",
  },
  recommendation: {
    bg: "rgba(249,115,22,0.16)",
    border: "#f97316",
    text: "#fdba74",
    minimap: "#f97316",
  },
};

type FlowNodeData = {
  label: string;
  sublabel?: string;
  kind: ExplorerNodeKind;
  dimmed: boolean;
  highlighted: boolean;
  selected: boolean;
};

function ExplorerFlowNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const colors = KIND_STYLE[d.kind];
  const opacity = d.dimmed ? 0.22 : 1;
  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${d.selected || d.highlighted ? "#fff" : colors.border}`,
        boxShadow: d.selected
          ? `0 0 0 2px ${colors.border}55`
          : d.highlighted
            ? `0 0 12px ${colors.border}66`
            : "none",
        color: colors.text,
        opacity,
        borderRadius: 10,
        padding: "8px 10px",
        minWidth: 110,
        maxWidth: 180,
        fontSize: 11,
        lineHeight: 1.25,
        transition: "opacity 280ms ease, box-shadow 280ms ease, border-color 280ms ease",
      }}
    >
      <div className="font-semibold tracking-tight">{d.label}</div>
      {d.sublabel ? (
        <div className="mt-0.5 text-[10px] opacity-70">{d.sublabel}</div>
      ) : null}
    </div>
  );
}

const nodeTypes = { explorer: ExplorerFlowNode };

function toFlowElements(
  nodes: ExplorerGraphNode[],
  edges: ExplorerGraphEdge[],
  selectedId: string | null,
  highlighted: Set<string>,
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const laid = layoutEvidenceExplorerGraph(nodes, edges);
  const hasSelection = Boolean(selectedId);

  const flowNodes: Node[] = laid.nodes.map((n) => {
    const size = nodeSize(n.kind);
    const isSelected = n.id === selectedId;
    const isHi = highlighted.has(n.id);
    return {
      id: n.id,
      type: "explorer",
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        sublabel: n.sublabel,
        kind: n.kind,
        dimmed: hasSelection && !isHi,
        highlighted: isHi && !isSelected,
        selected: isSelected,
      } satisfies FlowNodeData,
      style: { width: size.w, height: size.h },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const flowEdges: Edge[] = laid.edges.map((e) => {
    const active =
      hasSelection && highlighted.has(e.source) && highlighted.has(e.target);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: active,
      style: {
        stroke: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
        strokeWidth: active ? 2 : 1,
        opacity: hasSelection && !active ? 0.15 : 1,
        transition: "opacity 280ms ease, stroke 280ms ease",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
      },
    };
  });

  return { flowNodes, flowEdges };
}

function EvidenceGraphInner({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onToggleCluster,
}: {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCluster: (clusterId: string) => void;
}) {
  const { fitView } = useReactFlow();
  const highlighted = useMemo(
    () => collectHighlightIds(selectedNodeId, nodes, edges),
    [selectedNodeId, nodes, edges],
  );

  const initial = useMemo(
    () => toFlowElements(nodes, edges, selectedNodeId, highlighted),
    // Only recompute structure when graph identity changes; selection handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initial.flowNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initial.flowEdges);
  const fitOnce = useRef(false);

  useEffect(() => {
    const next = toFlowElements(nodes, edges, selectedNodeId, highlighted);
    setFlowNodes(next.flowNodes);
    setFlowEdges(next.flowEdges);
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.18, duration: fitOnce.current ? 420 : 650 });
      fitOnce.current = true;
    }, 40);
    return () => window.clearTimeout(t);
  }, [
    nodes,
    edges,
    selectedNodeId,
    highlighted,
    setFlowNodes,
    setFlowEdges,
    fitView,
  ]);

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      if (String(node.id).startsWith("cluster:")) {
        onToggleCluster(node.id);
        onSelectNode(node.id);
        return;
      }
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, onToggleCluster, selectedNodeId],
  );

  return (
    <div className="panel relative h-[min(72vh,720px)] min-h-[420px] overflow-hidden p-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Evidence Graph
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["document", "Document"],
              ["dimension", "Dimension"],
              ["finding", "Finding"],
              ["recommendation", "Recommendation"],
              ["risk", "Risk"],
            ] as const
          ).map(([kind, label]) => (
            <span
              key={kind}
              className="flex items-center gap-1 text-[10px] text-zinc-500"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: KIND_STYLE[kind].border }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background gap={22} size={1} color="rgba(255,255,255,0.04)" />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900/90 !border-white/10 !shadow-none [&>button]:!bg-zinc-900 [&>button]:!border-white/10 [&>button]:!fill-zinc-300"
        />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const kind = (n.data as FlowNodeData | undefined)?.kind ?? "document";
            return KIND_STYLE[kind].minimap;
          }}
          maskColor="rgba(0,0,0,0.55)"
          className="!bg-zinc-950/80 !border-white/10"
        />
      </ReactFlow>
    </div>
  );
}

export function EvidenceGraph(props: {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCluster: (clusterId: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <EvidenceGraphInner {...props} />
    </ReactFlowProvider>
  );
}
