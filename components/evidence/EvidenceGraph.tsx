"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
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
  collectProvenancePath,
  layoutProvenanceGraph,
  nodeSize,
  provenanceLayoutKey,
  PROVENANCE_COLORS,
  type ProvenanceGraphEdge,
  type ProvenanceGraphNode,
  type ProvenanceNodeKind,
} from "@/lib/application/provenance";

type FlowNodeData = {
  label: string;
  sublabel?: string;
  kind: ProvenanceNodeKind;
  dimmed: boolean;
  highlighted: boolean;
  selected: boolean;
  provenanceAvailable: boolean;
};

function ProvenanceFlowNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const colors = PROVENANCE_COLORS[d.kind];
  const opacity = d.dimmed ? 0.2 : 1;
  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${
          d.selected || d.highlighted ? "#fff" : colors.border
        }`,
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
        maxWidth: 184,
        fontSize: 11,
        lineHeight: 1.25,
        transition:
          "opacity 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
      }}
    >
      <div className="font-semibold tracking-tight">{d.label}</div>
      {d.sublabel ? (
        <div className="mt-0.5 text-[10px] opacity-70">{d.sublabel}</div>
      ) : null}
      {!d.provenanceAvailable ? (
        <div className="mt-1 text-[9px] text-amber-200/80">No provenance</div>
      ) : null}
    </div>
  );
}

const nodeTypes = { provenance: ProvenanceFlowNode };

const LEGEND: ProvenanceNodeKind[] = [
  "document",
  "fact",
  "dimension",
  "finding",
  "recommendation",
  "risk",
  "score",
];

function applySelectionStyles(
  nodes: Node[],
  edges: Edge[],
  selectedId: string | null,
  highlighted: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const hasSelection = Boolean(selectedId);
  return {
    nodes: nodes.map((n) => {
      const isSelected = n.id === selectedId;
      const isHi = highlighted.has(n.id);
      const prev = n.data as FlowNodeData;
      return {
        ...n,
        // Keep positions from memoized layout — only restyle selection.
        data: {
          ...prev,
          dimmed: hasSelection && !isHi,
          highlighted: isHi && !isSelected,
          selected: isSelected,
        },
      };
    }),
    edges: edges.map((e) => {
      const active =
        hasSelection && highlighted.has(e.source) && highlighted.has(e.target);
      return {
        ...e,
        animated: active,
        style: {
          ...e.style,
          stroke: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
          strokeWidth: active ? 2 : 1,
          opacity: hasSelection && !active ? 0.12 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
        },
      };
    }),
  };
}

function buildStructuralFlow(
  nodes: ProvenanceGraphNode[],
  edges: ProvenanceGraphEdge[],
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const laid = layoutProvenanceGraph(nodes, edges);
  const flowNodes: Node[] = laid.nodes.map((n) => {
    const size = nodeSize(n.kind);
    return {
      id: n.id,
      type: "provenance",
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        sublabel: n.sublabel,
        kind: n.kind,
        dimmed: false,
        highlighted: false,
        selected: false,
        provenanceAvailable: n.provenanceAvailable,
      } satisfies FlowNodeData,
      style: { width: size.w, height: size.h },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const flowEdges: Edge[] = laid.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
    style: {
      stroke: "rgba(255,255,255,0.12)",
      strokeWidth: 1,
      opacity: 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: "rgba(255,255,255,0.2)",
    },
  }));

  return { flowNodes, flowEdges };
}

function EvidenceGraphInner({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onToggleCluster,
  fullscreen,
  onToggleFullscreen,
}: {
  nodes: ProvenanceGraphNode[];
  edges: ProvenanceGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCluster: (clusterId: string) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { fitView } = useReactFlow();
  const layoutKey = useMemo(
    () => provenanceLayoutKey(nodes, edges),
    [nodes, edges],
  );
  const { highlighted } = useMemo(
    () => collectProvenancePath(selectedNodeId, nodes, edges),
    [selectedNodeId, nodes, edges],
  );

  const structural = useMemo(
    () => buildStructuralFlow(nodes, edges),
    // layoutKey encodes node/edge identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(
    structural.flowNodes,
  );
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(
    structural.flowEdges,
  );
  const lastLayoutKey = useRef("");
  const fitOnce = useRef(false);

  useEffect(() => {
    const styled = applySelectionStyles(
      structural.flowNodes,
      structural.flowEdges,
      selectedNodeId,
      highlighted,
    );

    if (lastLayoutKey.current !== layoutKey) {
      lastLayoutKey.current = layoutKey;
      setFlowNodes(styled.nodes);
      setFlowEdges(styled.edges);
      const t = window.setTimeout(() => {
        void fitView({ padding: 0.18, duration: fitOnce.current ? 360 : 600 });
        fitOnce.current = true;
      }, 40);
      return () => window.clearTimeout(t);
    }

    // Selection-only update — do not recompute dagre positions.
    setFlowNodes((prev) => {
      const byId = new Map(styled.nodes.map((n) => [n.id, n]));
      return prev.map((n) => {
        const next = byId.get(n.id);
        if (!next) return n;
        return { ...n, data: next.data, position: n.position };
      });
    });
    setFlowEdges(styled.edges);

    if (selectedNodeId) {
      const t = window.setTimeout(() => {
        void fitView({
          padding: 0.3,
          duration: 320,
          nodes: [{ id: selectedNodeId }],
        });
      }, 30);
      return () => window.clearTimeout(t);
    }
  }, [
    layoutKey,
    structural,
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

  const resetView = useCallback(() => {
    void fitView({ padding: 0.18, duration: 420 });
  }, [fitView]);

  return (
    <div
      className={`panel relative overflow-hidden p-0 ${
        fullscreen
          ? "fixed inset-3 z-50 h-[calc(100vh-1.5rem)]"
          : "h-[min(72vh,720px)] min-h-[420px]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Provenance graph
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Why the AI believes scores, risks, and recommendations
          </p>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          {LEGEND.map((kind) => (
            <span
              key={kind}
              className="flex items-center gap-1 text-[10px] text-zinc-500"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PROVENANCE_COLORS[kind].border }}
              />
              {PROVENANCE_COLORS[kind].label}
            </span>
          ))}
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 text-[10px] text-zinc-300 hover:border-white/20"
          >
            Reset view
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 text-[10px] text-zinc-300 hover:border-white/20"
          >
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
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
        minZoom={0.12}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background gap={22} size={1} color="rgba(255,255,255,0.04)" />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900/90 !border-white/10 !shadow-none [&>button]:!bg-zinc-900 [&>button]:!border-white/10 [&>button]:!fill-zinc-300"
        />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const kind =
              (n.data as FlowNodeData | undefined)?.kind ?? "document";
            return PROVENANCE_COLORS[kind].border;
          }}
          maskColor="rgba(0,0,0,0.55)"
          className="!bg-zinc-950/80 !border-white/10"
        />
      </ReactFlow>
    </div>
  );
}

export function EvidenceGraph(props: {
  nodes: ProvenanceGraphNode[];
  edges: ProvenanceGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCluster: (clusterId: string) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <ReactFlowProvider>
      <EvidenceGraphInner
        {...props}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
      />
    </ReactFlowProvider>
  );
}
