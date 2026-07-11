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
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import type { AssessmentGoalDashboardContext } from "@/lib/domain/assessment-goal";
import { buildExecutiveBrief } from "@/lib/application/build-brief";
import { toDimensionSummary, toRiskCardView } from "@/lib/domain";
import {
  buildAssessmentGoalDashboardContext,
  loadAssessmentGoalDashboardContext,
} from "@/lib/assessment-goals";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  getLatestHealthScore,
  listFindings,
  listRecommendations,
  listRisks,
  listTimelineEvents,
} from "@/lib/supabase/repository";
import { createEvidenceRepository } from "@/lib/repositories";
import { getCompanyClassification } from "@/lib/classification/persist";
import { computeEvidenceCoverage } from "@/lib/coverage";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";
import {
  buildDimensionCoverage,
  deriveConfidenceMethod,
  deriveScoreMethod,
  isValidPriorAssessment,
  sanitizeHealthAssessment,
} from "./sanitize-health";
import type {
  DashboardMetric,
  DashboardProvenance,
  TenantDashboardView,
} from "./types";

function defaultAssessmentGoalContext(
  companyId: string,
): AssessmentGoalDashboardContext {
  const now = new Date().toISOString();
  return buildAssessmentGoalDashboardContext({
    companyId,
    goal: DEFAULT_ASSESSMENT_GOAL,
    selectedBy: null,
    selectedAt: now,
    lastUpdated: now,
  });
}

const EMPTY_HEALTH: HealthScore = {
  score: 0,
  scoreAvailable: false,
  status: "insufficient",
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
    hasPriorSnapshot: false,
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
  scoreAvailable?: boolean;
}): DashboardMetric[] {
  const highPriorityActions = input.recommendations.filter(
    (r) => r.priority === "high",
  ).length;
  const highRisks = input.risks.filter((r) => r.severity === "high").length;
  const scoreAvailable = input.scoreAvailable !== false;

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
      value: scoreAvailable ? `${input.confidence}%` : "—",
      change: !scoreAvailable
        ? "Awaiting findings"
        : input.confidence >= 85
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
  assessmentGoal?: AssessmentGoalDashboardContext;
}): TenantDashboardView {
  const healthScore = EMPTY_HEALTH;
  const documentCount = input.documentCount ?? 0;
  const provenance: DashboardProvenance = {
    company_id: input.companyId,
    snapshot_id: null,
    prior_snapshot_id: null,
    generated_at: null,
    document_count: documentCount,
    evidence_count: 0,
    dimension_coverage: { scored: 0, total: 0 },
    score_method: "none",
    confidence_method: "none",
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
      scoreAvailable: false,
    }),
    assessmentGoal:
      input.assessmentGoal ?? defaultAssessmentGoalContext(input.companyId),
    evidenceCoverage: null,
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

  const { data: snapshotRows, error: snapshotError } = await client
    .from("analysis_snapshots")
    .select("id, created_at, as_of, payload")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(2);

  if (snapshotError) {
    throw new Error(`loadTenantDashboard.snapshot: ${snapshotError.message}`);
  }

  const snapshotRow = snapshotRows?.[0] ?? null;
  const priorSnapshotRow = snapshotRows?.[1] ?? null;

  const latest = await getLatestHealthScore(client, companyId);

  const assessmentGoal = await loadAssessmentGoalDashboardContext({
    client,
    companyId,
  }).catch(() => defaultAssessmentGoalContext(companyId));

  if (!latest && !snapshotRow) {
    return emptyTenantDashboard({
      companyId,
      companyName,
      documentCount,
      assessmentGoal,
    });
  }

  const [findings, risks, recommendations, timelineEvents, evidence, classification] =
    await Promise.all([
      listFindings(client, companyId),
      listRisks(client, companyId),
      listRecommendations(client, companyId),
      listTimelineEvents(client, companyId),
      createEvidenceRepository({ client }).listByCompany(companyId),
      getCompanyClassification(client, companyId).catch(() => null),
    ]);

  const evidenceCoverage = computeEvidenceCoverage({
    evidence,
    stage: classification?.stage ?? null,
    generatedAt:
      snapshotRow?.created_at ?? new Date().toISOString(),
  });

  const rawHealth = latest?.healthScore ?? {
    ...EMPTY_HEALTH,
    lastUpdated: snapshotRow?.as_of ?? snapshotRow?.created_at ?? "—",
  };
  const rawDimensions: HealthDimension[] = latest?.dimensions ?? [];
  const rawScoreChange = latest?.scoreChange ?? null;

  const sanitized = sanitizeHealthAssessment({
    healthScore: rawHealth,
    dimensions: rawDimensions,
    scoreChange: rawScoreChange,
    findingsCount: findings.length,
  });

  let { healthScore, scoreChange: scoreChangeExplanation } = sanitized;
  const { dimensions } = sanitized;

  const { data: priorScores } = await client
    .from("health_scores")
    .select("id, score, status, confidence, dimensions, as_of, score_change")
    .eq("company_id", companyId)
    .order("as_of", { ascending: false })
    .limit(2);

  const priorRow = priorScores && priorScores.length > 1 ? priorScores[1] : null;
  const priorValid =
    priorRow != null &&
    isValidPriorAssessment({
      score: Number(priorRow.score),
      status: String(priorRow.status),
      dimensions: priorRow.dimensions as HealthDimension[] | null,
      findingsCount: findings.length,
    });

  if (!priorValid || !healthScore.scoreAvailable) {
    scoreChangeExplanation = {
      ...scoreChangeExplanation,
      hasPriorSnapshot: false,
      change: 0,
      previousScore: healthScore.score,
      currentScore: healthScore.score,
      summary: healthScore.scoreAvailable
        ? "No prior assessment to compare."
        : scoreChangeExplanation.summary,
      drivers: healthScore.scoreAvailable
        ? scoreChangeExplanation.drivers.map((d) => ({
            ...d,
            periodDelta: 0,
          }))
        : [],
    };
    healthScore = {
      ...healthScore,
      change: 0,
      changeLabel: healthScore.scoreAvailable
        ? "No prior assessment"
        : healthScore.changeLabel,
    };
  } else if (!scoreChangeExplanation.hasPriorSnapshot) {
    // Reconstruct delta from two real persisted rows when payload omitted it.
    const priorScore = Number(priorRow.score);
    const change = healthScore.score - priorScore;
    scoreChangeExplanation = {
      ...scoreChangeExplanation,
      hasPriorSnapshot: true,
      previousScore: priorScore,
      currentScore: healthScore.score,
      change,
      summary: `Health ${priorScore} → ${healthScore.score} (${change > 0 ? "+" : ""}${change}) across scored dimensions.`,
    };
    healthScore = {
      ...healthScore,
      change,
      changeLabel:
        change > 0
          ? `+${change} vs prior`
          : change < 0
            ? `${change} vs prior`
            : "unchanged",
    };
  }

  const previous = priorValid
    ? {
        healthScore: {
          score: Number(priorRow!.score),
          confidence: Number(priorRow!.confidence),
        },
        dimensions: (priorRow!.dimensions as HealthDimension[] | null)?.map(
          (d) => ({
            id: d.id,
            name: d.name,
            score: d.score,
          }),
        ),
      }
    : undefined;

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

  const coverage = buildDimensionCoverage(dimensions);
  const provenance: DashboardProvenance = {
    company_id: companyId,
    snapshot_id: snapshotRow?.id ?? priorScores?.[0]?.id ?? null,
    prior_snapshot_id: priorValid
      ? (priorSnapshotRow?.id ?? priorRow?.id ?? null)
      : null,
    generated_at:
      snapshotRow?.created_at ??
      (typeof healthScore.lastUpdated === "string"
        ? healthScore.lastUpdated
        : null),
    document_count: documentCount,
    evidence_count: evidence.length,
    dimension_coverage: coverage,
    score_method: deriveScoreMethod(healthScore),
    confidence_method: deriveConfidenceMethod(healthScore),
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
      scoreAvailable: healthScore.scoreAvailable,
    }),
    assessmentGoal,
    evidenceCoverage,
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
  view: Omit<TenantDashboardView, "provenance" | "assessmentGoal"> & {
    provenance?: Partial<DashboardProvenance>;
    assessmentGoal?: AssessmentGoalDashboardContext;
  },
): TenantDashboardView {
  const companyId = view.provenance?.company_id ?? "company-acme";
  return {
    ...view,
    assessmentGoal:
      view.assessmentGoal ?? defaultAssessmentGoalContext(companyId),
    provenance: {
      company_id: "company-acme",
      snapshot_id: "demo-acme",
      prior_snapshot_id: null,
      generated_at: new Date().toISOString(),
      document_count: view.evidenceCatalog.totalDocuments,
      evidence_count: view.evidenceCatalog.totalDocuments,
      dimension_coverage: buildDimensionCoverage(view.dimensions ?? []),
      score_method: "findings_weighted",
      confidence_method: "evidence_coverage",
      source: "demo",
      ...view.provenance,
    },
  };
}

export type { Evidence };
