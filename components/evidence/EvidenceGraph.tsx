import type { EvidenceGraphEdge, EvidenceGraphNode } from "@/lib/types";

interface EvidenceGraphProps {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  selectedNodeId?: string;
}

const nodeColors: Record<EvidenceGraphNode["type"], { fill: string; stroke: string; text: string }> = {
  document: { fill: "rgba(99,102,241,0.15)", stroke: "rgba(99,102,241,0.5)", text: "#a5b4fc" },
  dimension: { fill: "rgba(34,197,94,0.12)", stroke: "rgba(34,197,94,0.4)", text: "#4ade80" },
  risk: { fill: "rgba(239,68,68,0.12)", stroke: "rgba(239,68,68,0.4)", text: "#f87171" },
  insight: { fill: "rgba(245,158,11,0.12)", stroke: "rgba(245,158,11,0.4)", text: "#fbbf24" },
};

export function EvidenceGraph({ nodes, edges, selectedNodeId }: EvidenceGraphProps) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="panel h-full min-h-[320px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Evidence Graph
        </p>
        <div className="flex flex-wrap gap-2">
          {(["document", "dimension", "risk", "insight"] as const).map((type) => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: nodeColors[type].stroke }}
              />
              {type}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 560 440" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {edges.map((edge) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const isHighlighted =
            selectedNodeId === edge.from || selectedNodeId === edge.to;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x + 50}
              y1={from.y + 14}
              x2={to.x}
              y2={to.y + 14}
              stroke={isHighlighted ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}
              strokeWidth={isHighlighted ? 1.5 : 1}
            />
          );
        })}
        {nodes.map((node) => {
          const colors = nodeColors[node.type];
          const isSelected = selectedNodeId === node.id;
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.type === "document" ? 100 : 80}
                height={28}
                rx={6}
                fill={isSelected ? "rgba(99,102,241,0.25)" : colors.fill}
                stroke={isSelected ? "#6366f1" : colors.stroke}
                strokeWidth={isSelected ? 1.5 : 1}
              />
              <text
                x={node.x + (node.type === "document" ? 50 : 40)}
                y={node.y + 18}
                textAnchor="middle"
                className="text-[11px] font-medium"
                fill={colors.text}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
