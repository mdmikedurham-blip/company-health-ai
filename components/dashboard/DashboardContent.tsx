"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionCard } from "@/components/ActionCard";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { AssessmentGoalCard } from "@/components/dashboard/AssessmentGoalCard";
import { EvidenceCoveragePanel } from "@/components/dashboard/EvidenceCoveragePanel";
import { NextBestActionsCard } from "@/components/dashboard/NextBestActionsCard";
import { ScoreChangeCard } from "@/components/dashboard/ScoreChangeCard";
import { ValueNavigatorPanel } from "@/components/dashboard/ValueNavigatorPanel";
import { EvidenceCard } from "@/components/EvidenceCard";
import { HealthDimensionRow } from "@/components/HealthDimensionRow";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { MetricCard } from "@/components/MetricCard";
import { RiskCard } from "@/components/RiskCard";
import type { TenantDashboardView } from "@/lib/dashboard";

export function DashboardContent({ view }: { view: TenantDashboardView }) {
  const router = useRouter();
  const {
    metrics: dashboardMetrics,
    assessmentGoal,
    valueNavigator,
    evidenceCoverage,
    healthScore,
    scoreChangeExplanation,
    executiveBrief,
    nextBestActions,
    topRisks,
    healthDimensions,
    insights,
    recommendations,
    evidenceCatalog,
    provenance,
  } = view;

  return (
    <div className="space-y-5">
      <AssessmentGoalCard assessmentGoal={assessmentGoal} />

      <ValueNavigatorPanel view={valueNavigator} />

      {evidenceCoverage ? (
        <EvidenceCoveragePanel coverage={evidenceCoverage} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            change={metric.change}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <HealthScoreCard
            score={healthScore.score}
            status={healthScore.status}
            change={healthScore.change}
            changeLabel={healthScore.changeLabel}
            lastUpdated={healthScore.lastUpdated}
            confidence={healthScore.confidence}
            scoreAvailable={healthScore.scoreAvailable}
            hasPriorSnapshot={scoreChangeExplanation.hasPriorSnapshot}
            summary={scoreChangeExplanation.summary}
          />
        </div>
        <div className="panel lg:col-span-3 p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Today&apos;s Executive Brief
            </p>
            <Link
              href="/brief"
              className="text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Full brief →
            </Link>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
            {executiveBrief.headline}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {executiveBrief.overallSummary}
          </p>
          <ul className="mt-4 space-y-2">
            {executiveBrief.primaryDrivers.map((driver) => (
              <li key={driver.id} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                <span>
                  {driver.title}{" "}
                  <span
                    className={
                      driver.healthImpact > 0
                        ? "text-emerald-400"
                        : driver.healthImpact < 0
                          ? "text-red-400"
                          : "text-zinc-500"
                    }
                  >
                    {driver.healthImpact > 0 ? "+" : ""}
                    {driver.healthImpact}
                  </span>
                  <span className="text-zinc-600">
                    {" "}
                    · {driver.businessMateriality} materiality ·{" "}
                    {driver.evidenceCount} evidence
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreChangeCard
          data={scoreChangeExplanation}
          onExplain={() => router.push("/timeline")}
        />
        <NextBestActionsCard actions={nextBestActions} />
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        <div className="xl:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top Risks
            </p>
            <Link
              href="/doctor?prompt=What%20are%20the%20biggest%20risks%3F"
              className="text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Ask Company Doctor →
            </Link>
          </div>
          <div className="grid gap-3">
            {topRisks.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-6 text-sm text-zinc-500">
                No risks in the current assessment.
              </p>
            ) : (
              topRisks.map((risk, index) => (
                <RiskCard
                  key={risk.id}
                  rank={index + 1}
                  title={risk.title}
                  level={risk.level}
                  dimension={risk.dimension}
                  summary={risk.summary}
                  source={risk.source}
                  riskId={risk.id}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Health Dimensions
              </p>
              <Link
                href="/health"
                className="text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {healthDimensions.length === 0 ? (
                <p className="py-4 text-sm text-zinc-500">No dimension scores yet.</p>
              ) : (
                healthDimensions.map((dimension) => (
                  <HealthDimensionRow
                    key={dimension.id ?? dimension.name}
                    name={dimension.name}
                    score={dimension.score}
                    status={dimension.status}
                    scored={dimension.scored}
                    trend={dimension.trend}
                    trendValue={dimension.trendValue}
                    dimensionId={dimension.id}
                  />
                ))
              )}
            </div>
          </div>
          <AIInsightsPanel insights={insights} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Recommended Actions
            </p>
            <span className="text-[11px] text-zinc-600">
              {recommendations.length} open
            </span>
          </div>
          <div className="space-y-2">
            {recommendations.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-6 text-sm text-zinc-500">
                No open actions in the current assessment.
              </p>
            ) : (
              recommendations.map((action) => (
                <ActionCard
                  key={action.id}
                  title={action.title}
                  priority={action.priority}
                  dimension={action.dimension}
                  description={action.description}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <EvidenceCard
            totalDocuments={evidenceCatalog.totalDocuments}
            systemsConnected={evidenceCatalog.systemsConnected}
            lastFullScan={evidenceCatalog.lastFullScan}
            sources={evidenceCatalog.connectors}
          />
          <Link
            href="/evidence"
            className="block rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-3 text-center text-xs font-medium text-indigo-400 transition-colors hover:border-indigo-500/25 hover:bg-indigo-500/5"
          >
            Open Evidence Explorer →
          </Link>
        </div>
      </div>

      <p
        className="text-[10px] text-zinc-600"
        data-dashboard-source={provenance.source}
        data-company-id={provenance.company_id}
        data-snapshot-id={provenance.snapshot_id ?? ""}
        data-prior-snapshot-id={provenance.prior_snapshot_id ?? ""}
        data-document-count={provenance.document_count}
        data-evidence-count={provenance.evidence_count}
        data-score-method={provenance.score_method}
        data-confidence-method={provenance.confidence_method}
        data-dimension-coverage={`${provenance.dimension_coverage.scored}/${provenance.dimension_coverage.total}`}
        data-coverage-ratio={provenance.coverage_ratio ?? ""}
        data-confidence={provenance.confidence ?? ""}
        data-analysis-version={provenance.analysis_version ?? ""}
      >
        Source: {provenance.source}
        {provenance.snapshot_id
          ? ` · snapshot ${provenance.snapshot_id.slice(0, 8)}`
          : ""}
        {provenance.generated_at
          ? ` · generated ${provenance.generated_at}`
          : ""}
        {provenance.coverage_ratio != null
          ? ` · coverage ${Math.round(provenance.coverage_ratio * 100)}%`
          : ""}
        {provenance.confidence != null
          ? ` · confidence ${Math.round(provenance.confidence)}`
          : ""}
        {" · "}
        {provenance.document_count} processed docs
        {" · "}
        {provenance.dimension_coverage.scored}/
        {provenance.dimension_coverage.total} dims scored
        {" · "}
        {provenance.score_method}
      </p>
    </div>
  );
}
