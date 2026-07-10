import type { CompanyHealthSnapshot } from "@/lib/domain";
import type { EvidenceGraphEdge, EvidenceGraphNode } from "@/lib/types";

const DOC_X = 80;
const DIM_X = 280;
const OUTCOME_X = 480;

/**
 * Derive the evidence graph from a CompanyHealthSnapshot.
 * Updates automatically as connectors add evidence.
 */
export function buildEvidenceGraph(snapshot: CompanyHealthSnapshot): {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
} {
  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];
  const dimensionY = new Map<string, number>();

  snapshot.evidence.forEach((doc, i) => {
    nodes.push({
      id: doc.id,
      label: doc.title.split(" ")[0] ?? doc.title,
      type: "document",
      x: DOC_X,
      y: 60 + i * 70,
    });

    if (!dimensionY.has(doc.dimensionId)) {
      dimensionY.set(doc.dimensionId, 60 + dimensionY.size * 80);
    }
    edges.push({ from: doc.id, to: doc.dimensionId });
  });

  for (const [dimId, y] of dimensionY) {
    const dim = snapshot.dimensions.find((d) => d.id === dimId);
    nodes.push({
      id: dimId,
      label: dim?.name ?? dimId,
      type: "dimension",
      x: DIM_X,
      y,
    });
  }

  let outcomeY = 50;
  for (const risk of snapshot.risks) {
    nodes.push({
      id: risk.id,
      label: risk.title.split(" ")[0] ?? risk.title,
      type: "risk",
      x: OUTCOME_X,
      y: outcomeY,
    });
    edges.push({ from: risk.dimensionId, to: risk.id });
    outcomeY += 80;
  }

  for (const insight of snapshot.insights) {
    nodes.push({
      id: insight.id,
      label: (insight.statement).split(" ")[0] ?? insight.statement,
      type: "insight",
      x: OUTCOME_X,
      y: outcomeY,
    });
    edges.push({ from: insight.dimensionId, to: insight.id });
    outcomeY += 80;
  }

  return { nodes, edges };
}
