"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionCard } from "@/components/ActionCard";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { NextBestActionsCard } from "@/components/dashboard/NextBestActionsCard";
import { ScoreChangeCard } from "@/components/dashboard/ScoreChangeCard";
import { EvidenceCard } from "@/components/EvidenceCard";
import { HealthDimensionRow } from "@/components/HealthDimensionRow";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { MetricCard } from "@/components/MetricCard";
import { RiskCard } from "@/components/RiskCard";
import {
  dashboardMetrics,
  evidenceCatalog,
  executiveBrief,
  healthDimensions,
  healthScore,
  insights,
  nextBestActions,
  recommendations,
  topRisks,
  scoreChangeExplanation,
} from "@/lib/data";

export function DashboardContent() {
  const router = useRouter();

  return (
    <div className="space-y-5">
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
            {topRisks.map((risk, index) => (
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
            ))}
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
              {healthDimensions.map((dimension) => (
                <HealthDimensionRow
                  key={dimension.id ?? dimension.name}
                  name={dimension.name}
                  score={dimension.score}
                  status={dimension.status}
                  trend={dimension.trend}
                  trendValue={dimension.trendValue}
                  dimensionId={dimension.id}
                />
              ))}
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
            {recommendations.map((action) => (
              <ActionCard
                key={action.id}
                title={action.title}
                priority={action.priority}
                dimension={action.dimension}
                description={action.description}
              />
            ))}
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
    </div>
  );
}
