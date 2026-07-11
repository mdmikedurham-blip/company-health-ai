/**
 * Build provenance graph strictly from persisted links.
 * Never invent edges when provenance arrays are empty.
 */

import type {
  Evidence,
  Finding,
  HealthScore,
  Recommendation,
  Risk,
  ScoreImpactExplanation,
} from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/domain/dimensions";
import type {
  ProvenanceBundle,
  ProvenanceGraphEdge,
  ProvenanceGraphNode,
  ProvenanceRecord,
} from "./types";

const META_FACT_KEYS = new Set([
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
]);

function isMetaKey(key: string): boolean {
  return (
    META_FACT_KEYS.has(key) ||
    key.endsWith("Worksheet") ||
    key.endsWith("Period") ||
    key.endsWith("Basis") ||
    key.endsWith("Currency") ||
    key.endsWith("SourceLabel")
  );
}

export function looksLikeBinaryOrPdfJunk(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  if (/%PDF-|endobj|startxref|\/Type\s*\/|stream\s*$/m.test(sample)) return true;
  if (/[\x00-\x08\x0E-\x1F]/.test(sample)) return true;
  // High ratio of non-printable / high-bit noise
  let weird = 0;
  for (let i = 0; i < Math.min(sample.length, 800); i++) {
    const c = sample.charCodeAt(i);
    if (c < 9 || (c > 13 && c < 32) || c === 127) weird++;
  }
  return weird / Math.min(sample.length, 800) > 0.08;
}

function normalizeDocType(evidence: Evidence): string {
  const fromFacts = evidence.extractedFacts.evidenceType;
  if (typeof fromFacts === "string" && fromFacts.trim()) return fromFacts.trim();
  if (evidence.sourceType && evidence.sourceType !== "general") {
    return evidence.sourceType;
  }
  const format = evidence.metadata.format;
  if (typeof format === "string" && format.trim()) return format.trim();
  return "document";
}

function typedFactEntries(evidence: Evidence): Array<{ key: string; value: string }> {
  const keys = evidence.extractedFacts.financialMetricKeys;
  const preferred = Array.isArray(keys)
    ? keys.map(String)
    : Object.keys(evidence.extractedFacts).filter((k) => !isMetaKey(k));
  return preferred
    .filter((k) => evidence.extractedFacts[k] != null && evidence.extractedFacts[k] !== "")
    .slice(0, 12)
    .map((key) => ({ key, value: String(evidence.extractedFacts[key]) }));
}

function buildAiSummary(evidence: Evidence): string {
  const recommended = evidence.extractedFacts.recommendedFindingTitle;
  if (typeof recommended === "string" && recommended.trim().length > 8) {
    return recommended.trim();
  }
  const facts = typedFactEntries(evidence);
  if (facts.length > 0) {
    return `Supports ${evidence.dimension || "analysis"} with ${facts.length} structured fact${facts.length === 1 ? "" : "s"} (${facts
      .slice(0, 4)
      .map((f) => f.key)
      .join(", ")}${facts.length > 4 ? "…" : ""}).`;
  }
  const summary = evidence.contentSummary?.trim() ?? "";
  if (!summary || looksLikeBinaryOrPdfJunk(summary)) {
    return `${normalizeDocType(evidence)} document processed for ${evidence.dimension || "company health"}.`;
  }
  if (summary.includes("\t") || summary.split("\n").length > 4) {
    return `${normalizeDocType(evidence)} evidence linked to ${evidence.dimension || "general"} analysis.`;
  }
  const first = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  return first.length > 180 ? `${first.slice(0, 177)}…` : first;
}

function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

export function buildProvenanceRecords(input: {
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  scoreExplanations?: ScoreImpactExplanation[];
  documentStatusById?: Map<string, string>;
}): ProvenanceRecord[] {
  const findingsById = new Map(input.findings.map((f) => [f.id, f]));
  const risksById = new Map(input.risks.map((r) => [r.id, r]));

  const scoreByEvidence = new Map<string, number>();
  for (const expl of input.scoreExplanations ?? []) {
    for (const impact of expl.impacts) {
      for (const evId of impact.evidenceIds) {
        scoreByEvidence.set(
          evId,
          (scoreByEvidence.get(evId) ?? 0) + impact.impact,
        );
      }
    }
  }

  return input.evidence.map((item) => {
    const docId =
      (typeof item.metadata.document_id === "string"
        ? item.metadata.document_id
        : null) ||
      (typeof item.metadata.documentId === "string"
        ? item.metadata.documentId
        : null) ||
      item.id;

    const linkedFindings = input.findings.filter((f) =>
      f.evidenceIds.includes(item.id),
    );
    const linkedFindingIds = [
      ...new Set([...item.findingIds, ...linkedFindings.map((f) => f.id)]),
    ];
    const linkedRisks = input.risks.filter(
      (r) =>
        r.evidenceIds.includes(item.id) ||
        r.findingIds.some((fid) => linkedFindingIds.includes(fid)),
    );
    const linkedRiskIds = [
      ...new Set([...item.linkedRiskIds, ...linkedRisks.map((r) => r.id)]),
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

    const raw = item.contentSummary || "";
    const technical = looksLikeBinaryOrPdfJunk(raw);
    const hasLinks =
      linkedFindingIds.length > 0 ||
      typedFactEntries(item).length > 0 ||
      linkedRiskIds.length > 0;

    return {
      id: item.id,
      sourceSystem: item.sourceSystem,
      documentName: item.title,
      documentType: normalizeDocType(item),
      documentStatus:
        input.documentStatusById?.get(docId) ??
        input.documentStatusById?.get(item.id) ??
        "unknown",
      confidence: Math.round(item.reliability > 1 ? item.reliability : item.reliability * 100),
      dimensions: dimensionIds.map(
        (id) => DIMENSION_NAMES[id] ?? item.dimension ?? id,
      ),
      dimensionIds,
      aiSummary: buildAiSummary(item),
      rawExtract: technical
        ? "(binary or PDF object stream hidden — open Technical details only if needed)"
        : raw || "(no raw extract)",
      rawExtractIsTechnicalOnly: technical,
      findingsCreated: linkedFindingIds
        .map((id) => findingsById.get(id)?.title)
        .filter((t): t is string => Boolean(t)),
      risksCreated: linkedRiskIds
        .map((id) => risksById.get(id)?.title)
        .filter((t): t is string => Boolean(t)),
      recommendationsCreated: linkedRecs.map((r) => r.title),
      processingDate: item.collectedAt,
      linkedFindingIds,
      linkedRiskIds,
      linkedRecommendationIds: linkedRecs.map((r) => r.id),
      linkedDimensionIds: dimensionIds,
      scoreContribution: scoreByEvidence.has(item.id)
        ? scoreByEvidence.get(item.id)!
        : null,
      provenanceAvailable: hasLinks,
    };
  });
}

export function buildProvenanceGraph(input: {
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  healthScore?: HealthScore | null;
  scoreExplanations?: ScoreImpactExplanation[];
  documentStatusById?: Map<string, string>;
  expandedClusterIds?: string[];
  /** Prefer these document ids in the initial subgraph. */
  focusDocumentIds?: string[];
  clusterThreshold?: number;
  maxInitialDocuments?: number;
}): {
  nodes: ProvenanceGraphNode[];
  edges: ProvenanceGraphEdge[];
  initialVisibleNodeIds: string[];
} {
  const expanded = new Set(input.expandedClusterIds ?? []);
  const threshold = input.clusterThreshold ?? 36;
  const maxInitial = input.maxInitialDocuments ?? 48;
  const nodes: ProvenanceGraphNode[] = [];
  const edges: ProvenanceGraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: ProvenanceGraphNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };
  const addEdge = (
    source: string,
    target: string,
    relation: ProvenanceGraphEdge["relation"],
  ) => {
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const id = `${source}->${target}`;
    if (edges.some((e) => e.id === id)) return;
    edges.push({ id, source, target, relation });
  };

  // Collapse duplicates by type + title fingerprint.
  const dupGroups = new Map<string, Evidence[]>();
  for (const ev of input.evidence) {
    const key = `${normalizeDocType(ev)}::${titleFingerprint(ev.title)}`;
    const list = dupGroups.get(key) ?? [];
    list.push(ev);
    dupGroups.set(key, list);
  }
  const representatives: Evidence[] = [];
  const collapseTo = new Map<string, string>();
  for (const [, group] of dupGroups) {
    const primary = group[0]!;
    representatives.push(primary);
    for (const m of group) collapseTo.set(m.id, primary.id);
  }

  // Relevance: docs with findings / score impacts first.
  const evidenceWithFindings = new Set(
    input.findings.flatMap((f) => f.evidenceIds),
  );
  const scoredEvidence = new Set(
    (input.scoreExplanations ?? []).flatMap((e) =>
      e.impacts.flatMap((i) => i.evidenceIds),
    ),
  );
  const focus = new Set(input.focusDocumentIds ?? []);

  const ranked = [...representatives].sort((a, b) => {
    const score = (e: Evidence) =>
      (focus.has(e.id) ? 100 : 0) +
      (evidenceWithFindings.has(e.id) ? 40 : 0) +
      (scoredEvidence.has(e.id) ? 30 : 0) +
      e.reliability;
    return score(b) - score(a);
  });

  const shouldCluster = ranked.length > threshold;
  const byType = new Map<string, Evidence[]>();
  for (const ev of ranked) {
    const t = normalizeDocType(ev);
    const list = byType.get(t) ?? [];
    list.push(ev);
    byType.set(t, list);
  }

  const visibleDocs: Evidence[] = [];
  if (shouldCluster) {
    for (const [type, group] of byType) {
      const clusterId = `cluster:${type}`;
      const keepOpen =
        expanded.has(clusterId) ||
        group.length <= 3 ||
        group.some((g) => focus.has(g.id) || evidenceWithFindings.has(g.id));
      if (keepOpen) {
        visibleDocs.push(...group.slice(0, maxInitial));
      } else {
        addNode({
          id: clusterId,
          kind: "cluster",
          label: `${type} documents`,
          sublabel: `${group.length} files`,
          documentType: type,
          memberIds: group.map((g) => g.id),
          relatedDocumentIds: group.map((g) => g.id),
          provenanceAvailable: group.some((g) => evidenceWithFindings.has(g.id)),
        });
      }
    }
  } else {
    visibleDocs.push(...ranked.slice(0, maxInitial));
  }

  const visibleSet = new Set(visibleDocs.map((d) => d.id));

  for (const ev of visibleDocs) {
    const members = [...collapseTo.entries()]
      .filter(([, rep]) => rep === ev.id)
      .map(([id]) => id);
    const docStatus =
      input.documentStatusById?.get(
        String(ev.metadata.document_id ?? ev.metadata.documentId ?? ev.id),
      ) ?? "unknown";
    const facts = typedFactEntries(ev);
    addNode({
      id: ev.id,
      kind: "document",
      label: truncate(ev.title, 28),
      sublabel: `${normalizeDocType(ev)} · ${docStatus}`,
      summary: buildAiSummary(ev),
      documentType: normalizeDocType(ev),
      documentStatus: docStatus,
      confidence: Math.round(ev.reliability > 1 ? ev.reliability : ev.reliability * 100),
      dimensionId: ev.dimensionId,
      memberIds: members.length > 1 ? members : undefined,
      relatedDocumentIds: members,
      sourceDocumentId: ev.id,
      timestamps: {
        occurredAt: ev.occurredAt,
        collectedAt: ev.collectedAt,
        processedAt: ev.collectedAt,
      },
      provenanceAvailable: facts.length > 0 || evidenceWithFindings.has(ev.id),
    });

    // One facts group node per document (persisted extracted_facts).
    const factsId = `facts:${ev.id}`;
    if (facts.length > 0) {
      addNode({
        id: factsId,
        kind: "fact",
        label: `${facts.length} extracted fact${facts.length === 1 ? "" : "s"}`,
        sublabel: facts
          .slice(0, 3)
          .map((f) => f.key)
          .join(", "),
        summary: facts.map((f) => `${f.key}: ${f.value}`).join("; "),
        sourceDocumentId: ev.id,
        relatedDocumentIds: [ev.id],
        provenanceAvailable: true,
      });
      addEdge(ev.id, factsId, "document-fact");

      const dimIds = [...new Set([ev.dimensionId, ...ev.dimensionIds])].filter(
        Boolean,
      );
      for (const dimId of dimIds) {
        addNode({
          id: dimId,
          kind: "dimension",
          label: DIMENSION_NAMES[dimId] ?? dimId,
          dimensionId: dimId,
          provenanceAvailable: true,
        });
        addEdge(factsId, dimId, "fact-dimension");
      }
    }
    // No facts: do not fabricate document→dimension edges.
    // Findings that cite this document still create finding→dimension links.
  }

  for (const node of nodes.filter((n) => n.kind === "cluster")) {
    const members = input.evidence.filter((e) => node.memberIds?.includes(e.id));
    for (const dimId of new Set(members.map((m) => m.dimensionId).filter(Boolean))) {
      addNode({
        id: dimId,
        kind: "dimension",
        label: DIMENSION_NAMES[dimId] ?? dimId,
        dimensionId: dimId,
        provenanceAvailable: true,
      });
      addEdge(node.id, dimId, "cluster-dimension");
    }
  }

  for (const finding of input.findings) {
    const relatedDocs = finding.evidenceIds.map((id) => collapseTo.get(id) ?? id);
    const inView = relatedDocs.some((id) => visibleSet.has(id));
    if (!inView && visibleSet.size > 0) {
      // Still include findings that have score impact even if doc clustered away
      const hasScore = (input.scoreExplanations ?? []).some((e) =>
        e.impacts.some((i) => i.findingId === finding.id),
      );
      if (!hasScore) continue;
    }

    addNode({
      id: finding.id,
      kind: "finding",
      label: truncate(finding.title, 32),
      sublabel: finding.dimension,
      summary: finding.description || finding.summary,
      confidence: Math.round(finding.confidence),
      dimensionId: finding.dimensionId,
      scoreContribution: finding.scoreImpact,
      relatedDocumentIds: relatedDocs,
      relatedFindingIds: [finding.id],
      provenanceAvailable: finding.evidenceIds.length > 0,
    });

    if (finding.dimensionId) {
      addNode({
        id: finding.dimensionId,
        kind: "dimension",
        label: DIMENSION_NAMES[finding.dimensionId] ?? finding.dimension,
        dimensionId: finding.dimensionId,
        provenanceAvailable: true,
      });
      addEdge(finding.id, finding.dimensionId, "finding-dimension");
    }

    for (const evId of finding.evidenceIds) {
      const rep = collapseTo.get(evId) ?? evId;
      if (nodeIds.has(rep)) addEdge(rep, finding.id, "document-finding");
      const factsId = `facts:${rep}`;
      if (nodeIds.has(factsId)) addEdge(factsId, finding.id, "fact-finding");
    }
  }

  for (const risk of input.risks) {
    const linked = risk.findingIds.some((fid) => nodeIds.has(fid));
    if (!linked && risk.evidenceIds.every((id) => !visibleSet.has(collapseTo.get(id) ?? id))) {
      continue;
    }
    addNode({
      id: risk.id,
      kind: "risk",
      label: truncate(risk.title, 32),
      sublabel: risk.severity,
      summary: risk.summary,
      confidence: Math.round(risk.confidence),
      dimensionId: risk.dimensionId,
      scoreContribution: risk.estimatedScoreImpact,
      relatedDocumentIds: risk.evidenceIds.map((id) => collapseTo.get(id) ?? id),
      relatedFindingIds: risk.findingIds,
      relatedRiskIds: [risk.id],
      provenanceAvailable: risk.findingIds.length > 0 || risk.evidenceIds.length > 0,
    });
    for (const fid of risk.findingIds) {
      if (nodeIds.has(fid)) addEdge(fid, risk.id, "finding-risk");
    }
  }

  for (const rec of input.recommendations) {
    const linked =
      rec.riskIds.some((id) => nodeIds.has(id)) ||
      rec.findingIds.some((id) => nodeIds.has(id));
    if (!linked) continue;
    addNode({
      id: rec.id,
      kind: "recommendation",
      label: truncate(rec.title, 32),
      sublabel: rec.priority,
      summary: rec.description,
      confidence: Math.round(rec.confidence),
      dimensionId: rec.dimensionId,
      relatedDocumentIds: rec.evidenceIds.map((id) => collapseTo.get(id) ?? id),
      relatedFindingIds: rec.findingIds,
      relatedRiskIds: rec.riskIds,
      relatedRecommendationIds: [rec.id],
      provenanceAvailable:
        rec.riskIds.length > 0 ||
        rec.findingIds.length > 0 ||
        rec.evidenceIds.length > 0,
    });
    for (const rid of rec.riskIds) {
      if (nodeIds.has(rid)) addEdge(rid, rec.id, "risk-recommendation");
    }
    for (const fid of rec.findingIds) {
      if (nodeIds.has(fid) && rec.riskIds.length === 0) {
        addEdge(fid, rec.id, "finding-recommendation");
      }
    }
  }

  // Score contribution nodes from persisted score_explanations only.
  for (const expl of input.scoreExplanations ?? []) {
    for (const impact of expl.impacts) {
      if (!impact.findingId || !nodeIds.has(impact.findingId)) continue;
      const scoreId = `score:${impact.findingId}:${expl.dimensionId}`;
      addNode({
        id: scoreId,
        kind: "score",
        label: `${impact.impact > 0 ? "+" : ""}${impact.impact} pts`,
        sublabel: DIMENSION_NAMES[expl.dimensionId] ?? expl.dimensionId,
        summary: impact.reason,
        scoreContribution: impact.impact,
        dimensionId: expl.dimensionId,
        relatedFindingIds: [impact.findingId],
        relatedDocumentIds: impact.evidenceIds.map(
          (id) => collapseTo.get(id) ?? id,
        ),
        provenanceAvailable: impact.evidenceIds.length > 0,
      });
      addEdge(impact.findingId, scoreId, "finding-score");
      if (nodeIds.has(expl.dimensionId)) {
        addEdge(expl.dimensionId, scoreId, "dimension-score");
      }
    }
  }

  // Initial visible set = all constructed nodes (already relevance-limited).
  const initialVisibleNodeIds = nodes.map((n) => n.id);

  return { nodes, edges, initialVisibleNodeIds };
}

export function collectProvenancePath(
  selectedId: string | null,
  nodes: ProvenanceGraphNode[],
  edges: ProvenanceGraphEdge[],
): { highlighted: Set<string>; breadcrumb: ProvenanceGraphNode[] } {
  if (!selectedId) return { highlighted: new Set(), breadcrumb: [] };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(selectedId)) return { highlighted: new Set(), breadcrumb: [] };

  const upstream = new Map<string, string[]>();
  const downstream = new Map<string, string[]>();
  for (const e of edges) {
    if (!downstream.has(e.source)) downstream.set(e.source, []);
    if (!upstream.has(e.target)) upstream.set(e.target, []);
    downstream.get(e.source)!.push(e.target);
    upstream.get(e.target)!.push(e.source);
  }

  const highlighted = new Set<string>([selectedId]);
  const walk = (start: string, adj: Map<string, string[]>, maxDepth: number) => {
    const q: Array<{ id: string; d: number }> = [{ id: start, d: 0 }];
    while (q.length) {
      const { id, d } = q.shift()!;
      if (d >= maxDepth) continue;
      for (const next of adj.get(id) ?? []) {
        if (highlighted.has(next)) continue;
        highlighted.add(next);
        q.push({ id: next, d: d + 1 });
      }
    }
  };
  walk(selectedId, upstream, 5);
  walk(selectedId, downstream, 5);

  // Breadcrumb: prefer document → fact → finding → risk/score chain
  const order: ProvenanceGraphNode["kind"][] = [
    "document",
    "cluster",
    "fact",
    "dimension",
    "finding",
    "risk",
    "recommendation",
    "score",
  ];
  const breadcrumb = [...highlighted]
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .sort(
      (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.label.localeCompare(b.label),
    )
    .slice(0, 8);

  return { highlighted, breadcrumb };
}

export function buildProvenanceBundle(input: {
  companyId: string;
  snapshotId: string | null;
  healthScoreId: string | null;
  asOf: string | null;
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  healthScore?: HealthScore | null;
  documentStatusById?: Map<string, string>;
  expandedClusterIds?: string[];
  focusDocumentIds?: string[];
}): ProvenanceBundle {
  const scoreExplanations = input.healthScore?.scoreExplanations ?? [];
  const records = buildProvenanceRecords({
    evidence: input.evidence,
    findings: input.findings,
    risks: input.risks,
    recommendations: input.recommendations,
    scoreExplanations,
    documentStatusById: input.documentStatusById,
  });
  const graph = buildProvenanceGraph({
    evidence: input.evidence,
    findings: input.findings,
    risks: input.risks,
    recommendations: input.recommendations,
    healthScore: input.healthScore,
    scoreExplanations,
    documentStatusById: input.documentStatusById,
    expandedClusterIds: input.expandedClusterIds,
    focusDocumentIds: input.focusDocumentIds,
  });

  return {
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    healthScoreId: input.healthScoreId,
    asOf: input.asOf,
    records,
    nodes: graph.nodes,
    edges: graph.edges,
    initialVisibleNodeIds: graph.initialVisibleNodeIds,
  };
}
