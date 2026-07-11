import type {
  Evidence,
  EvidenceCatalog,
  ExecutiveBrief,
  Finding,
  HealthDimension,
  HealthScore,
  Insight,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
} from "@/lib/domain";
import { buildExecutiveBrief } from "@/lib/application/build-brief";
import { toDimensionSummary, toRiskCardView } from "@/lib/domain";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  getLatestHealthScore,
  listFindings,
  listRecommendations,
  listRisks,
  listTimelineEvents,
} from "@/lib/supabase/repository";
import { createEvidenceRepository } from "@/lib/repositories";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";
import type {
  DashboardMetric,
  DashboardProvenance,
  TenantDashboardView,
} from "./types";

const EMPTY_HEALTH: HealthScore = {
  score: 0,
  status: "watch",
  change: 0,
  changeLabel: "No assessment yet",
  lastUpdated: "—",
  confidence: 0,
};

function emptyScoreChange(score: number): ScoreChangeExplanation {
  return {
    previousScore: score,
    currentScore: score,
    change: 0,
    period: "Current assessment",
    summary: "No prior assessment to compare.",
    drivers: [],
  };
}

function emptyBrief(healthScore: HealthScore): ExecutiveBrief {
  return buildExecutiveBrief({
    healthScore,
    dimensions: [],
    findings: [],
    risks: [],
    recommendations: [],
    evidence: [],
    timeline: [],
    seed: { boardMeeting: { date: "", daysUntil: 0, items: [] } },
    asOf: new Date().toISOString(),
  });
}

function buildCatalog(input: {
  documentCount: number;
  lastFullScan: string;
}): EvidenceCatalog {
  const systems =
    input.documentCount > 0
      ? [
          {
            id: MANUAL_UPLOAD_CONNECTOR_ID,
            name: "Manual Upload",
            system: "Manual Upload",
            status: "connected" as const,
            documentsAnalyzed: input.documentCount,
            lastSynced: input.lastFullScan,
          },
        ]
      : [];

  return {
    totalDocuments: input.documentCount,
    systemsConnected: systems.length,
    lastFullScan: input.lastFullScan,
    connectors: systems,
  };
}

function insightsFromFindings(findings: Finding[]): Insight[] {
  return [...findings]
    .sort((a, b) => Math.abs(b.scoreImpact) - Math.abs(a.scoreImpact))
    .slice(0, 5)
    .map((f) => ({
      id: `insight-${f.id}`,
      statement: f.summary || f.description || f.title,
      dimension: f.dimension,
      dimensionId: f.dimensionId,
      evidenceIds: f.evidenceIds,
      confidence: f.confidence,
      generatedAt: f.extractedAt || "—",
      ruleId: "persisted-finding",
      findingIds: [f.id],
      type: "neutral" as const,
    }));
}

export function buildDashboardMetrics(input: {
  documentCount: number;
  evidenceCount: number;
  risks: Risk[];
  recommendations: Recommendation[];
  confidence: number;
}): DashboardMetric[] {
  const highPriorityActions = input.recommendations.filter(
    (r) => r.priority === "high",
  ).length;
  const highRisks = input.risks.filter((r) => r.severity === "high").length;

  return [
    {
      label: "Documents analyzed",
      value: input.documentCount.toLocaleString(),
      change: `${input.evidenceCount} in current assessment`,
    },
    {
      label: "Active risks",
      value: String(input.risks.length),
      change:
        highRisks > 0
          ? `${highRisks} high severity`
          : input.risks.length === 0
            ? "None open"
            : "No high severity",
    },
    {
      label: "Open actions",
      value: String(input.recommendations.length),
      change:
        highPriorityActions > 0
          ? `${highPriorityActions} high priority`
          : input.recommendations.length === 0
            ? "None open"
            : "Prioritized by engine",
    },
    {
      label: "Confidence score",
      value: `${input.confidence}%`,
      change:
        input.confidence >= 85
          ? "High reliability"
          : input.confidence >= 60
            ? "Moderate reliability"
            : "Low — add evidence",
    },
  ];
}

function topRisks(risks: Risk[], limit = 3) {
  const severityOrder = { high: 0, medium: 1, low: 2 } as const;
  return [...risks]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, limit)
    .map(toRiskCardView);
}

function nextActions(recommendations: Recommendation[], limit = 3) {
  return [...recommendations]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

export function emptyTenantDashboard(input: {
  companyId: string;
  companyName: string;
  documentCount?: number;
}): TenantDashboardView {
  const healthScore = EMPTY_HEALTH;
  const documentCount = input.documentCount ?? 0;
  const provenance: DashboardProvenance = {
    company_id: input.companyId,
    snapshot_id: null,
    generated_at: null,
    document_count: documentCount,
    source: "empty_state",
  };
  return {
    provenance,
    companyName: input.companyName,
    metrics: buildDashboardMetrics({
      documentCount,
      evidenceCount: 0,
      risks: [],
      recommendations: [],
      confidence: 0,
    }),
    healthScore,
    scoreChangeExplanation: emptyScoreChange(0),
    executiveBrief: emptyBrief(healthScore),
    nextBestActions: [],
    topRisks: [],
    healthDimensions: [],
    insights: [],
    recommendations: [],
    evidenceCatalog: buildCatalog({
      documentCount,
      lastFullScan: "—",
    }),
    timelineEvents: [],
    dimensions: [],
  };
}

/**
 * Load dashboard metrics strictly scoped to companyId from persisted tables.
 * Never falls back to Acme/mock connectors.
 */
export async function loadTenantDashboard(input: {
  client: AppSupabaseClient;
  companyId: string;
  companyName: string;
}): Promise<TenantDashboardView> {
  const { client, companyId, companyName } = input;

  const { count: processedCount, error: countError } = await client
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "PROCESSED");

  if (countError) {
    throw new Error(`loadTenantDashboard.documents: ${countError.message}`);
  }

  const documentCount = processedCount ?? 0;

  const { data: snapshotRow, error: snapshotError } = await client
    .from("analysis_snapshots")
    .select("id, created_at, as_of, payload")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`loadTenantDashboard.snapshot: ${snapshotError.message}`);
  }

  const latest = await getLatestHealthScore(client, companyId);

  if (!latest && !snapshotRow) {
    return emptyTenantDashboard({ companyId, companyName, documentCount });
  }

  const [findings, risks, recommendations, timelineEvents, evidence] =
    await Promise.all([
      listFindings(client, companyId),
      listRisks(client, companyId),
      listRecommendations(client, companyId),
      listTimelineEvents(client, companyId),
      createEvidenceRepository({ client }).listByCompany(companyId),
    ]);

  const healthScore = latest?.healthScore ?? {
    ...EMPTY_HEALTH,
    lastUpdated: snapshotRow?.as_of ?? snapshotRow?.created_at ?? "—",
  };
  const dimensions: HealthDimension[] = latest?.dimensions ?? [];
  const scoreChangeExplanation =
    latest?.scoreChange ?? emptyScoreChange(healthScore.score);

  const { data: priorScores } = await client
    .from("health_scores")
    .select("score, confidence, dimensions, as_of")
    .eq("company_id", companyId)
    .order("as_of", { ascending: false })
    .limit(2);

  const priorRow = priorScores && priorScores.length > 1 ? priorScores[1] : null;

  const previous = priorRow
    ? {
        healthScore: {
          score: Number(priorRow.score),
          confidence: Number(priorRow.confidence),
        },
        dimensions: (priorRow.dimensions as HealthDimension[] | null)?.map(
          (d) => ({
            id: d.id,
            name: d.name,
            score: d.score,
          }),
        ),
      }
    : {
        healthScore: {
          score: scoreChangeExplanation.previousScore,
          confidence: healthScore.confidence,
        },
      };

  const executiveBrief = buildExecutiveBrief({
    healthScore,
    dimensions,
    findings,
    risks,
    recommendations,
    evidence,
    timeline: timelineEvents,
    previous,
    seed: { boardMeeting: { date: "", daysUntil: 0, items: [] } },
    asOf: healthScore.lastUpdated,
  });

  const provenance: DashboardProvenance = {
    company_id: companyId,
    snapshot_id: snapshotRow?.id ?? null,
    generated_at:
      snapshotRow?.created_at ??
      (typeof healthScore.lastUpdated === "string"
        ? healthScore.lastUpdated
        : null),
    document_count: documentCount,
    source: "persisted_analysis",
  };

  return {
    provenance,
    companyName,
    metrics: buildDashboardMetrics({
      documentCount,
      evidenceCount: evidence.length,
      risks,
      recommendations,
      confidence: healthScore.confidence,
    }),
    healthScore,
    scoreChangeExplanation,
    executiveBrief,
    nextBestActions: nextActions(recommendations),
    topRisks: topRisks(risks),
    healthDimensions: dimensions.map(toDimensionSummary),
    insights: insightsFromFindings(findings),
    recommendations,
    evidenceCatalog: buildCatalog({
      documentCount,
      lastFullScan: healthScore.lastUpdated,
    }),
    timelineEvents,
    dimensions,
  };
}

/** Build a demo view from the Acme in-memory snapshot — /demo only. */
export function loadDemoDashboardView(
  view: Omit<TenantDashboardView, "provenance"> & {
    provenance?: Partial<DashboardProvenance>;
  },
): TenantDashboardView {
  return {
    ...view,
    provenance: {
      company_id: "company-acme",
      snapshot_id: "demo-acme",
      generated_at: new Date().toISOString(),
      document_count: view.evidenceCatalog.totalDocuments,
      source: "demo",
      ...view.provenance,
    },
  };
}

export type { Evidence };
