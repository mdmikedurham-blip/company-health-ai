/**
 * Load a CompanyHealthSnapshot for Company Doctor from persisted tenant data.
 * Never falls back to Acme seed for real company UUIDs.
 */

import { buildExecutiveBrief } from "@/lib/application/build-brief";
import { getCurrentAssessmentSnapshot } from "@/lib/assessment-snapshots";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  getCompany,
  getLatestHealthScore,
  listFindings,
  listRecommendations,
  listRisks,
  listTimelineEvents,
} from "@/lib/supabase/repository";
import { createEvidenceRepository } from "@/lib/repositories";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "@/lib/uploads/constants";
import type {
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  EvidenceCatalog,
  Finding,
  HealthScore,
  Insight,
  ScoreChangeExplanation,
} from "@/lib/domain";

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

function emptyDna(): CompanyDNA {
  return {
    mission: "",
    revenueModel: "",
    customerSegments: [],
    products: [],
    keySystems: [],
    boardAndInvestors: [],
    operatingModel: "",
    topRisks: [],
    keyMetrics: [],
    upcomingDates: [],
  };
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

function fallbackCompany(companyId: string, name?: string | null): Company {
  return {
    id: companyId,
    name: name?.trim() || "Your company",
    plan: "",
    founded: "",
    stage: "",
    employees: 0,
    arr: "",
  };
}

/**
 * Assemble a doctor-ready snapshot from one published pack + live evidence,
 * or from normalized tables when no pack exists.
 */
export async function loadTenantDoctorSnapshot(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<CompanyHealthSnapshot> {
  const { client, companyId } = input;

  const [companyRow, current, evidence, docCountResult] = await Promise.all([
    getCompany(client, companyId).catch(() => null),
    getCurrentAssessmentSnapshot({ client, companyId }).catch(() => null),
    createEvidenceRepository({ client }).listByCompany(companyId),
    client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "PROCESSED"),
  ]);

  const company = companyRow ?? fallbackCompany(companyId);
  const documentCount = docCountResult.count ?? 0;
  const pack = current?.pack ?? null;

  if (pack) {
    const evidenceIds = new Set(pack.evidenceIds);
    const scopedEvidence =
      evidenceIds.size > 0
        ? evidence.filter((e) => evidenceIds.has(e.id))
        : evidence;
    const findings = pack.findings;
    const risks = pack.risks;
    const recommendations = pack.recommendations;
    const dimensions = pack.dimensions;
    const healthScore = pack.healthScore;
    const scoreChange = pack.scoreChange;
    const timeline = await listTimelineEvents(client, companyId).catch(
      () => [],
    );

    const executiveBrief = buildExecutiveBrief({
      healthScore,
      dimensions,
      findings,
      risks,
      recommendations,
      evidence: scopedEvidence,
      timeline,
      seed: { boardMeeting: { date: "", daysUntil: 0, items: [] } },
      asOf: healthScore.lastUpdated,
    });

    return {
      company,
      healthScore,
      dimensions,
      evidence: scopedEvidence,
      evidenceCatalog: buildCatalog({
        documentCount,
        lastFullScan: pack.createdAt,
      }),
      findings,
      insights: insightsFromFindings(findings),
      risks,
      recommendations,
      timeline,
      dna: emptyDna(),
      reports: [],
      scoreChange,
      executiveBrief,
      questionAnswers: pack.questionAnswers,
      questionCoverage: pack.questionCoverage ?? undefined,
      businessConcepts: pack.businessConcepts,
      assessmentSnapshotId: current?.snapshotId ?? pack.snapshotId ?? null,
    };
  }

  // No published pack — assemble from normalized current tables (same company only).
  const [latest, findings, risks, recommendations, timeline] =
    await Promise.all([
      getLatestHealthScore(client, companyId),
      listFindings(client, companyId),
      listRisks(client, companyId),
      listRecommendations(client, companyId),
      listTimelineEvents(client, companyId),
    ]);

  const healthScore = latest?.healthScore ?? EMPTY_HEALTH;
  const dimensions = latest?.dimensions ?? [];
  const scoreChange = latest?.scoreChange ?? emptyScoreChange(healthScore.score);

  const executiveBrief = buildExecutiveBrief({
    healthScore,
    dimensions,
    findings,
    risks,
    recommendations,
    evidence,
    timeline,
    seed: { boardMeeting: { date: "", daysUntil: 0, items: [] } },
    asOf: healthScore.lastUpdated,
  });

  return {
    company,
    healthScore,
    dimensions,
    evidence,
    evidenceCatalog: buildCatalog({
      documentCount,
      lastFullScan: healthScore.lastUpdated,
    }),
    findings,
    insights: insightsFromFindings(findings),
    risks,
    recommendations,
    timeline,
    dna: emptyDna(),
    reports: [],
    scoreChange,
    executiveBrief,
  };
}
