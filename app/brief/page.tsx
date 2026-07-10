import Link from "next/link";
import { ActionCard } from "@/components/ActionCard";
import { AppShell } from "@/components/AppShell";
import { ExportActions } from "@/components/brief/ExportActions";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { RiskCard } from "@/components/RiskCard";
import {
  executiveBrief,
  healthScore,
  recommendations,
  topRisks,
} from "@/lib/data";

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
  const { boardMeeting } = executiveBrief;

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
                {executiveBrief.date}
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
                {executiveBrief.summary}
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
            change={healthScore.change}
            changeLabel={healthScore.changeLabel}
            lastUpdated={healthScore.lastUpdated}
            confidence={healthScore.confidence}
          />
          <div className="panel p-5 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top Wins
            </p>
            <div className="mt-4 space-y-4">
              {executiveBrief.topWins.map((win, i) => (
                <div key={win.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{win.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{win.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top Risks
            </p>
            <div className="space-y-3">
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

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Recommended Actions
            </p>
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
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Board Meeting Prep
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {boardMeeting.date}
                <span className="ml-2 text-zinc-500">· {boardMeeting.daysUntil} days away</span>
              </p>
            </div>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              1 item needs attention
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boardMeeting.items.map((item) => (
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
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <ExportActions />
      </div>
    </AppShell>
  );
}
