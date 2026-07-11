import Link from "next/link";
import { ActionCard } from "@/components/ActionCard";
import { AppShell } from "@/components/AppShell";
import { ExportActions } from "@/components/brief/ExportActions";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { RiskCard } from "@/components/RiskCard";
import { loadAuthenticatedDashboardView } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

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

export default async function ExecutiveBriefPage() {
  const { view, companyName, userName, userEmail } =
    await loadAuthenticatedDashboardView();
  const { executiveBrief, healthScore } = view;

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
      userName={userName}
      companyName={companyName}
      userEmail={userEmail}
    >
      {view.provenance.source === "empty_state" ? (
        <div className="panel p-8 text-center text-sm text-zinc-500">
          No persisted analysis yet. Upload and process documents to generate a brief.
          <div className="mt-4">
            <Link href="/upload" className="text-indigo-400 hover:text-indigo-300">
              Upload documents →
            </Link>
          </div>
        </div>
      ) : (
      <div className="space-y-5">
        <div className="panel border-indigo-500/15 bg-indigo-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
                Causal executive brief
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {executiveBrief.headline}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                {executiveBrief.overallSummary}
              </p>
            </div>
            <ExportActions />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>
              Score {executiveBrief.scoreChange.currentScore}{" "}
              <span className="text-zinc-600">({changeLabel})</span>
            </span>
            <span>·</span>
            <span>{executiveBrief.confidence}% confidence</span>
            {boardMeeting?.date ? (
              <>
                <span>·</span>
                <span>
                  Board {boardMeeting.date}
                  {typeof boardMeeting.daysUntil === "number"
                    ? ` · ${boardMeeting.daysUntil}d`
                    : ""}
                </span>
              </>
            ) : null}
            {needsAttention > 0 ? (
              <>
                <span>·</span>
                <span className="text-amber-400">
                  {needsAttention} board item
                  {needsAttention === 1 ? "" : "s"} need attention
                </span>
              </>
            ) : null}
          </div>
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
              summary={executiveBrief.overallSummary}
            />
          </div>
          <div className="panel lg:col-span-3 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Primary drivers
            </p>
            <ul className="mt-3 space-y-3">
              {executiveBrief.primaryDrivers.length === 0 ? (
                <li className="text-sm text-zinc-500">No material drivers.</li>
              ) : (
                executiveBrief.primaryDrivers.map((driver) => (
                  <li key={driver.id} className="text-sm text-zinc-300">
                    <span className="font-medium text-zinc-100">{driver.title}</span>
                    <span className="text-zinc-500">
                      {" "}
                      · {driver.dimension} · impact {driver.healthImpact > 0 ? "+" : ""}
                      {driver.healthImpact}
                    </span>
                    <p className="mt-1 text-xs text-zinc-500">{driver.reason}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top risks
            </p>
            <div className="space-y-3">
              {executiveBrief.topRisks.length === 0 ? (
                <p className="text-sm text-zinc-500">No risks in this assessment.</p>
              ) : (
                executiveBrief.topRisks.map((risk, index) => (
                  <RiskCard
                    key={risk.riskId}
                    rank={index + 1}
                    title={risk.title}
                    level={risk.severity}
                    dimension={risk.dimension}
                    summary={risk.summary}
                    source=""
                    riskId={risk.riskId}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Recommended actions
            </p>
            <div className="space-y-2">
              {executiveBrief.recommendedActions.length === 0 ? (
                <p className="text-sm text-zinc-500">No actions in this assessment.</p>
              ) : (
                executiveBrief.recommendedActions.map((action) => (
                  <ActionCard
                    key={action.recommendationId}
                    title={action.title}
                    priority={action.priority}
                    dimension={action.dimension}
                    description={action.description}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {executiveBrief.boardImplications.length > 0 ? (
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Board implications
            </p>
            <ul className="mt-3 space-y-2">
              {executiveBrief.boardImplications.map((item) => (
                <li
                  key={item.title}
                  className={`rounded-md border px-3 py-2 text-sm ${boardStatusStyles[item.status]}`}
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide">
                    {boardStatusLabels[item.status]}
                  </span>
                  {item.detail ? (
                    <p className="mt-1 text-xs opacity-80">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      )}
    </AppShell>
  );
}
