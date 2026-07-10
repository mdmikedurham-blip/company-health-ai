import Link from "next/link";
import { ActionCard } from "@/components/ActionCard";
import { AppShell } from "@/components/AppShell";
import { ExportActions } from "@/components/brief/ExportActions";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { RiskCard } from "@/components/RiskCard";
import { executiveBrief, healthScore } from "@/lib/data";

const boardStatusStyles = {
  ready: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "needs-attention": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  pending: "text-zinc-400 bg-white/[0.04] border-white/10",
};

const boardStatusLabels = {
  ready: "Ready",
  "needs-attention": "Needs attention",
  pending: "Pending",
};

export default function ExecutiveBriefPage() {
  const boardMeeting = executiveBrief.boardMeeting;
  const needsAttention = executiveBrief.boardImplications.filter(
    (item) => item.status === "needs-attention",
  ).length;

  const changeLabel =
    executiveBrief.scoreChange.change > 0
      ? `+${executiveBrief.scoreChange.change} vs prior`
      : executiveBrief.scoreChange.change < 0
        ? `${executiveBrief.scoreChange.change} vs prior`
        : "unchanged";

  return (
    <AppShell
      title="Executive Brief"
      subtitle={`${executiveBrief.date} · Generated ${executiveBrief.generatedAt}`}
    >
      <div className="space-y-5">
        <div className="panel border-indigo-500/15 bg-indigo-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
                Daily CEO Briefing
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {executiveBrief.headline}
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
                {executiveBrief.overallSummary}
              </p>
              <p className="mt-2 text-[11px] text-zinc-600">
                Confidence {executiveBrief.confidence}% · Generated automatically
              </p>
            </div>
            <Link
              href="/doctor?prompt=Generate%20a%20board%20update."
              className="shrink-0 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/40"
            >
              Ask Company Doctor →
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <HealthScoreCard
            score={healthScore.score}
            status={healthScore.status}
            change={executiveBrief.scoreChange.change}
            changeLabel={changeLabel}
            lastUpdated={healthScore.lastUpdated}
            confidence={executiveBrief.confidence}
            summary={executiveBrief.overallSummary}
          />
          <div className="panel p-5 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Why did it change?
            </p>
            <div className="mt-4 space-y-4">
              {executiveBrief.primaryDrivers.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No material drivers identified for this period.
                </p>
              ) : (
                executiveBrief.primaryDrivers.map((driver, i) => (
                  <div key={driver.id} className="flex gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        driver.healthImpact >= 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">
                        {driver.title}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            Health Impact
                          </p>
                          <p
                            className={`text-xs font-medium tabular-nums ${
                              driver.healthImpact > 0
                                ? "text-emerald-400"
                                : driver.healthImpact < 0
                                  ? "text-red-400"
                                  : "text-zinc-400"
                            }`}
                          >
                            {driver.healthImpact > 0 ? "+" : ""}
                            {driver.healthImpact}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            Confidence
                          </p>
                          <p className="text-xs font-medium tabular-nums text-zinc-300">
                            {driver.confidence}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            Evidence
                          </p>
                          <p className="text-xs font-medium tabular-nums text-zinc-300">
                            {driver.evidenceCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            Materiality
                          </p>
                          <p
                            className={`text-xs font-medium capitalize ${
                              driver.businessMateriality === "high"
                                ? "text-amber-400"
                                : driver.businessMateriality === "medium"
                                  ? "text-zinc-300"
                                  : "text-zinc-500"
                            }`}
                          >
                            {driver.businessMateriality}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        {driver.reason}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top Risks
            </p>
            <div className="space-y-3">
              {executiveBrief.topRisks.map((risk, index) => (
                <RiskCard
                  key={risk.riskId}
                  rank={index + 1}
                  title={risk.title}
                  level={risk.severity}
                  dimension={risk.dimension}
                  summary={risk.summary}
                  source={risk.evidenceIds[0] ?? "—"}
                  riskId={risk.riskId}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Recommended Actions
            </p>
            <div className="space-y-2">
              {executiveBrief.recommendedActions.map((action) => (
                <ActionCard
                  key={action.recommendationId}
                  title={action.title}
                  priority={action.priority}
                  dimension={action.dimension}
                  description={action.description}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Board Meeting Prep
              </p>
              {boardMeeting && (
                <p className="mt-1 text-sm text-zinc-300">
                  {boardMeeting.date}
                  <span className="ml-2 text-zinc-500">
                    · {boardMeeting.daysUntil} days away
                  </span>
                </p>
              )}
            </div>
            {needsAttention > 0 && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                {needsAttention} item{needsAttention === 1 ? "" : "s"} needs
                attention
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {executiveBrief.boardImplications.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-[var(--border)] bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${boardStatusStyles[item.status]}`}
                  >
                    {boardStatusLabels[item.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <ExportActions />
      </div>
    </AppShell>
  );
}
