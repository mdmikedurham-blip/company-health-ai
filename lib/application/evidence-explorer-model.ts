/**
 * Evidence Explorer graph model:
 * Document → Extracted Facts → Dimensions → Findings → Risks → Recommendations
 *
 * Clusters documents by type and collapses near-duplicates for large corpora.
 */

import type {
  Evidence,
  Finding,
  Recommendation,
  Risk,
} from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/domain/dimensions";

export type ExplorerNodeKind =
  | "document"
  | "fact"
  | "dimension"
  | "finding"
  | "risk"
  | "recommendation"
  | "cluster";

export type ExplorerGraphNode = {
  id: string;
  kind: ExplorerNodeKind;
  label: string;
  /** Secondary line (type, count, etc.). */
  sublabel?: string;
  dimensionId?: string;
  documentType?: string;
  confidence?: number;
  /** Member document ids when kind === cluster or collapsed duplicate. */
  memberIds?: string[];
  /** For highlighting / filters. */
  relatedDocumentIds?: string[];
};

export type ExplorerGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type EvidenceExplorerRecord = {
  id: string;
  sourceSystem: string;
  documentName: string;
  documentType: string;
  confidence: number;
  dimensions: string[];
  dimensionIds: string[];
  /** Short human summary — never raw extraction dump. */
  aiSummary: string;
  /** Developer raw extract (expandable). */
  rawExtract: string;
  findingsCreated: string[];
  risksCreated: string[];
  recommendationsCreated: string[];
  processingDate: string;
  linkedFindingIds: string[];
  linkedRiskIds: string[];
  linkedRecommendationIds: string[];
  linkedDimensionIds: string[];
};

export type EvidenceExplorerFilterDimension =
  | "Financial"
  | "Governance"
  | "Legal"
  | "Security"
  | "Customer"
  | "People";

const FILTER_DIMENSION_IDS: Record<EvidenceExplorerFilterDimension, string[]> = {
  Financial: ["dim-financial", "dim-revenue-quality"],
  Governance: ["dim-governance"],
  Legal: ["dim-legal"],
  Security: ["dim-security"],
  Customer: ["dim-customer"],
  People: ["dim-people"],
};

function normalizeDocType(evidence: Evidence): string {
  const fromFacts = evidence.extractedFacts.evidenceType;
  if (typeof fromFacts === "string" && fromFacts.trim()) {
    return fromFacts.trim();
  }
  if (evidence.sourceType && evidence.sourceType !== "general") {
    return evidence.sourceType;
  }
  const format = evidence.metadata.format;
  if (typeof format === "string" && format.trim()) return format.trim();
  return "document";
}

function factKeys(evidence: Evidence): string[] {
  const keys = evidence.extractedFacts.financialMetricKeys;
  if (Array.isArray(keys)) return keys.map(String);
  return Object.keys(evidence.extractedFacts).filter(
    (k) =>
      ![
        "extractionFacts",
        "recommendedFindingTitle",
        "recommendedFindingDirection",
        "recommendedFindingMateriality",
        "evidenceType",
        "extractionDateCount",
        "extractionAmountCount",
        "extractionPeople",
        "financialMetricKeys",
        "financialMetricCount",
        "financialFactsComplete",
        "missingFinancialFields",
        "financialExtractionSource",
      ].includes(k) &&
      !k.endsWith("Worksheet") &&
      !k.endsWith("Period") &&
      !k.endsWith("Basis") &&
      !k.endsWith("Currency") &&
      !k.endsWith("SourceLabel"),
  );
}

function buildAiSummary(evidence: Evidence): string {
  const recommended = evidence.extractedFacts.recommendedFindingTitle;
  if (typeof recommended === "string" && recommended.trim().length > 8) {
    return recommended.trim();
  }
  const keys = factKeys(evidence);
  if (keys.length > 0) {
    const dim = evidence.dimension || "company health";
    return `Structured ${normalizeDocType(evidence)} evidence for ${dim} with ${keys.length} extracted metric${keys.length === 1 ? "" : "s"} (${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}).`;
  }
  const summary = evidence.contentSummary?.trim() ?? "";
  if (!summary) return "Processed document awaiting richer structured extraction.";
  // Avoid dumping long raw extract into the card summary.
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  if (firstSentence.length > 180) return `${firstSentence.slice(0, 177)}…`;
  // If summary looks like a TSV dump, replace with a softer line.
  if (firstSentence.includes("\t") || firstSentence.split("\n").length > 3) {
    return `${normalizeDocType(evidence)} document linked to ${evidence.dimension || "general"} analysis.`;
  }
  return firstSentence;
}

function buildRawExtract(evidence: Evidence): string {
  const parts: string[] = [];
  if (evidence.contentSummary?.trim()) {
    parts.push(evidence.contentSummary.trim());
  }
  const facts = evidence.extractedFacts.extractionFacts;
  if (Array.isArray(facts) && facts.length > 0) {
    parts.push("— Extraction facts —");
    parts.push(facts.map(String).join("\n"));
  }
  const metricKeys = factKeys(evidence);
  if (metricKeys.length > 0) {
    parts.push("— Typed metrics —");
    for (const key of metricKeys) {
      parts.push(`${key}: ${String(evidence.extractedFacts[key])}`);
    }
  }
  return parts.join("\n\n") || "(no raw extract)";
}

function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Project domain evidence + intelligence into explorer list cards.
 */
export function buildEvidenceExplorerRecords(input: {
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
}): EvidenceExplorerRecord[] {
  const findingsById = new Map(input.findings.map((f) => [f.id, f]));
  const risksById = new Map(input.risks.map((r) => [r.id, r]));
  const recsById = new Map(input.recommendations.map((r) => [r.id, r]));

  return input.evidence.map((item) => {
    const linkedFindings = input.findings.filter((f) =>
      f.evidenceIds.includes(item.id),
    );
    const linkedFindingIds = [
      ...new Set([
        ...item.findingIds,
        ...linkedFindings.map((f) => f.id),
      ]),
    ];
    const linkedRisks = input.risks.filter(
      (r) =>
        r.evidenceIds.includes(item.id) ||
        r.findingIds.some((fid) => linkedFindingIds.includes(fid)),
    );
    const linkedRiskIds = [
      ...new Set([
        ...item.linkedRiskIds,
        ...linkedRisks.map((r) => r.id),
      ]),
    ];
    const linkedRecs = input.recommendations.filter(
      (rec) =>
        rec.evidenceIds.includes(item.id) ||
        rec.findingIds.some((fid) => linkedFindingIds.includes(fid)) ||
        rec.riskIds.some((rid) => linkedRiskIds.includes(rid)),
    );

    const dimensionIds = [
      ...new Set([
        item.dimensionId,
        ...item.dimensionIds,
        ...linkedFindings.map((f) => f.dimensionId),
      ]),
    ].filter(Boolean);

    return {
      id: item.id,
      sourceSystem: item.sourceSystem,
      documentName: item.title,
      documentType: normalizeDocType(item),
      confidence: Math.round(item.reliability),
      dimensions: dimensionIds.map(
        (id) => DIMENSION_NAMES[id] ?? item.dimension ?? id,
      ),
      dimensionIds,
      aiSummary: buildAiSummary(item),
      rawExtract: buildRawExtract(item),
      findingsCreated: linkedFindingIds
        .map((id) => findingsById.get(id)?.title)
        .filter((t): t is string => Boolean(t)),
      risksCreated: linkedRiskIds
        .map((id) => risksById.get(id)?.title)
        .filter((t): t is string => Boolean(t)),
      recommendationsCreated: linkedRecs
        .map((r) => recsById.get(r.id)?.title ?? r.title)
        .filter(Boolean),
      processingDate: item.collectedAt,
      linkedFindingIds,
      linkedRiskIds,
      linkedRecommendationIds: linkedRecs.map((r) => r.id),
      linkedDimensionIds: dimensionIds,
    };
  });
}

export function filterMatchesDimension(
  record: EvidenceExplorerRecord,
  filter: EvidenceExplorerFilterDimension,
): boolean {
  const ids = FILTER_DIMENSION_IDS[filter];
  return record.dimensionIds.some((id) => ids.includes(id));
}

/**
 * Build relationship graph with clustering for large corpora.
 */
export function buildEvidenceExplorerGraph(input: {
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  /** Expand these cluster ids to show member documents. */
  expandedClusterIds?: string[];
  /** Max individual document nodes before clustering by type. */
  clusterThreshold?: number;
}): { nodes: ExplorerGraphNode[]; edges: ExplorerGraphEdge[] } {
  const expanded = new Set(input.expandedClusterIds ?? []);
  const threshold = input.clusterThreshold ?? 40;
  const nodes: ExplorerGraphNode[] = [];
  const edges: ExplorerGraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: ExplorerGraphNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };
  const addEdge = (source: string, target: string) => {
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const id = `${source}->${target}`;
    if (edges.some((e) => e.id === id)) return;
    edges.push({ id, source, target });
  };

  // Collapse duplicate documents (same type + title fingerprint).
  const duplicateGroups = new Map<string, Evidence[]>();
  for (const ev of input.evidence) {
    const key = `${normalizeDocType(ev)}::${titleFingerprint(ev.title)}`;
    const list = duplicateGroups.get(key) ?? [];
    list.push(ev);
    duplicateGroups.set(key, list);
  }

  const representatives: Evidence[] = [];
  const duplicateCollapse = new Map<string, string>(); // memberId → representativeId

  for (const [, group] of duplicateGroups) {
    const primary = group[0]!;
    representatives.push(primary);
    for (const member of group) {
      duplicateCollapse.set(member.id, primary.id);
    }
    if (group.length > 1) {
      // Annotate later via memberIds on the document node
    }
  }

  const shouldCluster = representatives.length > threshold;
  const byType = new Map<string, Evidence[]>();
  for (const ev of representatives) {
    const type = normalizeDocType(ev);
    const list = byType.get(type) ?? [];
    list.push(ev);
    byType.set(type, list);
  }

  const visibleDocs: Evidence[] = [];

  if (shouldCluster) {
    for (const [type, group] of byType) {
      const clusterId = `cluster:${type}`;
      if (expanded.has(clusterId) || group.length <= 3) {
        visibleDocs.push(...group);
      } else {
        addNode({
          id: clusterId,
          kind: "cluster",
          label: `${type} documents`,
          sublabel: `${group.length} files`,
          documentType: type,
          memberIds: group.map((g) => g.id),
          relatedDocumentIds: group.map((g) => g.id),
        });
      }
    }
  } else {
    visibleDocs.push(...representatives);
  }

  for (const ev of visibleDocs) {
    const dupes = [...duplicateCollapse.entries()]
      .filter(([, rep]) => rep === ev.id)
      .map(([id]) => id);
    addNode({
      id: ev.id,
      kind: "document",
      label: truncate(ev.title, 28),
      sublabel: normalizeDocType(ev),
      documentType: normalizeDocType(ev),
      confidence: Math.round(ev.reliability),
      dimensionId: ev.dimensionId,
      memberIds: dupes.length > 1 ? dupes : undefined,
      relatedDocumentIds: dupes,
    });

    const keys = factKeys(ev);
    const factsId = `facts:${ev.id}`;
    addNode({
      id: factsId,
      kind: "fact",
      label: keys.length > 0 ? `${keys.length} facts` : "Extracted facts",
      sublabel: keys.slice(0, 3).join(", ") || "structured fields",
      relatedDocumentIds: [ev.id],
    });
    addEdge(ev.id, factsId);

    const dimIds = [...new Set([ev.dimensionId, ...ev.dimensionIds])];
    for (const dimId of dimIds) {
      if (!dimId) continue;
      addNode({
        id: dimId,
        kind: "dimension",
        label: DIMENSION_NAMES[dimId] ?? dimId,
        dimensionId: dimId,
      });
      addEdge(factsId, dimId);
    }
  }

  // Link clusters to dimensions via member docs (summary edges).
  for (const node of nodes.filter((n) => n.kind === "cluster")) {
    const members = input.evidence.filter((e) =>
      node.memberIds?.includes(e.id),
    );
    const dimIds = new Set(members.map((m) => m.dimensionId).filter(Boolean));
    for (const dimId of dimIds) {
      addNode({
        id: dimId,
        kind: "dimension",
        label: DIMENSION_NAMES[dimId] ?? dimId,
        dimensionId: dimId,
      });
      addEdge(node.id, dimId);
    }
  }

  for (const finding of input.findings) {
    addNode({
      id: finding.id,
      kind: "finding",
      label: truncate(finding.title, 32),
      sublabel: finding.dimension,
      dimensionId: finding.dimensionId,
      confidence: finding.confidence,
      relatedDocumentIds: finding.evidenceIds.map(
        (id) => duplicateCollapse.get(id) ?? id,
      ),
    });
    addNode({
      id: finding.dimensionId,
      kind: "dimension",
      label: DIMENSION_NAMES[finding.dimensionId] ?? finding.dimension,
      dimensionId: finding.dimensionId,
    });
    addEdge(finding.dimensionId, finding.id);
    for (const evId of finding.evidenceIds) {
      const rep = duplicateCollapse.get(evId) ?? evId;
      if (nodeIds.has(rep)) addEdge(rep, finding.id);
      const factsId = `facts:${rep}`;
      if (nodeIds.has(factsId)) addEdge(factsId, finding.id);
    }
  }

  for (const risk of input.risks) {
    addNode({
      id: risk.id,
      kind: "risk",
      label: truncate(risk.title, 32),
      sublabel: risk.severity,
      dimensionId: risk.dimensionId,
      confidence: risk.confidence,
      relatedDocumentIds: risk.evidenceIds.map(
        (id) => duplicateCollapse.get(id) ?? id,
      ),
    });
    for (const fid of risk.findingIds) {
      if (nodeIds.has(fid)) addEdge(fid, risk.id);
    }
    if (risk.findingIds.length === 0 && risk.dimensionId) {
      addNode({
        id: risk.dimensionId,
        kind: "dimension",
        label: DIMENSION_NAMES[risk.dimensionId] ?? risk.dimension,
        dimensionId: risk.dimensionId,
      });
      addEdge(risk.dimensionId, risk.id);
    }
  }

  for (const rec of input.recommendations) {
    addNode({
      id: rec.id,
      kind: "recommendation",
      label: truncate(rec.title, 32),
      sublabel: rec.priority,
      dimensionId: rec.dimensionId,
      confidence: rec.confidence,
      relatedDocumentIds: rec.evidenceIds.map(
        (id) => duplicateCollapse.get(id) ?? id,
      ),
    });
    for (const rid of rec.riskIds) {
      if (nodeIds.has(rid)) addEdge(rid, rec.id);
    }
    for (const fid of rec.findingIds) {
      if (nodeIds.has(fid) && rec.riskIds.length === 0) addEdge(fid, rec.id);
    }
  }

  return { nodes, edges };
}

/** Connected component ids for highlight (BFS along undirected edges). */
export function collectHighlightIds(
  selectedId: string | null,
  nodes: ExplorerGraphNode[],
  edges: ExplorerGraphEdge[],
): Set<string> {
  if (!selectedId) return new Set();
  const selected = nodes.find((n) => n.id === selectedId);
  if (!selected) return new Set([selectedId]);

  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  const highlighted = new Set<string>([selectedId]);

  // Prefer one-hop + typed chain rather than full graph flood for readability.
  const queue = [selectedId];
  const depth = new Map<string, number>([[selectedId, 0]]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur) ?? 0;
    if (d >= 4) continue;
    for (const next of adj.get(cur) ?? []) {
      if (highlighted.has(next)) continue;
      highlighted.add(next);
      depth.set(next, d + 1);
      queue.push(next);
    }
  }

  // Also expand cluster members / related documents.
  if (selected.memberIds) {
    for (const id of selected.memberIds) highlighted.add(id);
  }
  if (selected.relatedDocumentIds) {
    for (const id of selected.relatedDocumentIds) highlighted.add(id);
  }

  return highlighted;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

export { FILTER_DIMENSION_IDS };
