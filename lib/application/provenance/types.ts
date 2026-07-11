/**
 * Provenance hub types — Evidence Explorer as trust/explanation surface.
 */

export type ProvenanceNodeKind =
  | "document"
  | "fact"
  | "dimension"
  | "finding"
  | "risk"
  | "recommendation"
  | "score"
  | "cluster";

export type ProvenanceGraphNode = {
  id: string;
  kind: ProvenanceNodeKind;
  label: string;
  sublabel?: string;
  summary?: string;
  confidence?: number;
  dimensionId?: string;
  documentType?: string;
  documentStatus?: string;
  /** Score impact points when kind === score or finding. */
  scoreContribution?: number;
  memberIds?: string[];
  relatedDocumentIds?: string[];
  relatedFindingIds?: string[];
  relatedRiskIds?: string[];
  relatedRecommendationIds?: string[];
  sourceDocumentId?: string;
  timestamps?: { occurredAt?: string; collectedAt?: string; processedAt?: string };
  /** True when this node exists only as a shell with no persisted links. */
  provenanceAvailable: boolean;
};

export type ProvenanceGraphEdge = {
  id: string;
  source: string;
  target: string;
  /** Persisted link type for debugging / filters. */
  relation:
    | "document-fact"
    | "fact-finding"
    | "fact-dimension"
    | "document-finding"
    | "finding-dimension"
    | "finding-risk"
    | "finding-recommendation"
    | "risk-recommendation"
    | "finding-score"
    | "dimension-score"
    | "cluster-dimension"
    | "unavailable";
};

export type ProvenanceRecord = {
  id: string;
  sourceSystem: string;
  documentName: string;
  documentType: string;
  documentStatus: string;
  confidence: number;
  dimensions: string[];
  dimensionIds: string[];
  aiSummary: string;
  rawExtract: string;
  /** True when raw extract looks like binary/PDF object stream junk. */
  rawExtractIsTechnicalOnly: boolean;
  findingsCreated: string[];
  risksCreated: string[];
  recommendationsCreated: string[];
  processingDate: string;
  linkedFindingIds: string[];
  linkedRiskIds: string[];
  linkedRecommendationIds: string[];
  linkedDimensionIds: string[];
  scoreContribution: number | null;
  provenanceAvailable: boolean;
};

export type ProvenanceBundle = {
  companyId: string;
  snapshotId: string | null;
  healthScoreId: string | null;
  asOf: string | null;
  records: ProvenanceRecord[];
  nodes: ProvenanceGraphNode[];
  edges: ProvenanceGraphEdge[];
  /** Seed subgraph node ids for initial render. */
  initialVisibleNodeIds: string[];
};

export type ProvenanceFilters = {
  query: string;
  dimensions: Set<string>;
  nodeKinds: Set<ProvenanceNodeKind>;
  minConfidence: number;
  dateFrom: string;
  dateTo: string;
  documentTypes: Set<string>;
  statuses: Set<string>;
};

export const PROVENANCE_COLORS: Record<
  ProvenanceNodeKind,
  { bg: string; border: string; text: string; label: string }
> = {
  document: {
    bg: "rgba(59,130,246,0.18)",
    border: "#3b82f6",
    text: "#93c5fd",
    label: "Document",
  },
  cluster: {
    bg: "rgba(59,130,246,0.28)",
    border: "#60a5fa",
    text: "#bfdbfe",
    label: "Document cluster",
  },
  fact: {
    bg: "rgba(161,161,170,0.14)",
    border: "#a1a1aa",
    text: "#d4d4d8",
    label: "Fact",
  },
  dimension: {
    bg: "rgba(34,197,94,0.16)",
    border: "#22c55e",
    text: "#86efac",
    label: "Dimension",
  },
  finding: {
    bg: "rgba(234,179,8,0.16)",
    border: "#eab308",
    text: "#fde047",
    label: "Finding",
  },
  recommendation: {
    bg: "rgba(249,115,22,0.16)",
    border: "#f97316",
    text: "#fdba74",
    label: "Recommendation",
  },
  risk: {
    bg: "rgba(239,68,68,0.16)",
    border: "#ef4444",
    text: "#fca5a5",
    label: "Risk",
  },
  score: {
    bg: "rgba(168,85,247,0.16)",
    border: "#a855f7",
    text: "#d8b4fe",
    label: "Score contribution",
  },
};
