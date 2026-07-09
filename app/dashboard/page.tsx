import Link from "next/link";
import { PriorityBadge, RiskBadge, StatusBadge } from "@/components/Badges";
import { ConnectorIcon } from "@/components/ConnectorIcon";
import { CONNECTOR_CATALOG } from "@/lib/domain";
import { loadCompanyDNA } from "@/lib/company/load-company-dna";
import {
  dimensionDisplayName,
  evidenceTitles,
} from "@/lib/insight-engine";

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function DashboardPage() {
  const dna = await loadCompanyDNA();
  const {
    health,
    risks,
    insights,
    findings,
    recommendations,
    evidence,
    timeline,
    connectedSystems,
  } = dna;

  const connectorMeta = CONNECTOR_CATALOG.filter((c) =>
    connectedSystems.includes(c.id),
  );

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />

      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-500/30">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Company Health AI
              </span>
            </Link>
            <span className="hidden text-zinc-600 sm:inline">/</span>
            <span className="hidden text-sm text-zinc-400 sm:inline">
              Intelligence
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span>
              {dna.companyName}
              {dna.stage ? ` · ${dna.stage}` : ""}
            </span>
            <StatusBadge status={health.status} />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl space-y-10 px-6 py-10">
        {/* Score + pipeline summary */}
        <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="glass-card flex flex-col items-center justify-center rounded-2xl p-6">
            <div className="relative">
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#dashScore)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(health.overall / 100) * 327} 327`}
                />
                <defs>
                  <linearGradient id="dashScore" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{health.overall}</span>
                <span className="text-[10px] text-zinc-500">/ 100</span>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">Overall Health</p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              {health.evidenceCount} evidence · {findings.length} findings ·{" "}
              {risks.length} risks
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Company DNA
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Insight Engine pipeline — evidence in, prioritized actions out
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                Generated {formatTime(dna.generatedAt)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Evidence → Findings",
                  value: `${evidence.length} → ${findings.length}`,
                },
                {
                  label: "Findings → Risks",
                  value: `${findings.length} → ${risks.length}`,
                },
                {
                  label: "Risks → Recommendations",
                  value: `${risks.length} → ${recommendations.length}`,
                },
                {
                  label: "Connectors",
                  value: String(connectedSystems.length),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {health.dimensions.map((dim) => (
                <div key={dim.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-zinc-400">
                    {dim.name}
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-xs tabular-nums text-zinc-300">
                    {dim.score}
                  </span>
                  <StatusBadge status={dim.status} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Risks */}
          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Risks
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Derived from findings with health-score impact
            </p>
            <div className="mt-5 space-y-3">
              {risks.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{risk.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{risk.detail}</p>
                      <p className="mt-2 text-[11px] text-zinc-600">
                        {dimensionDisplayName(risk.dimension)} · impact −
                        {risk.healthImpact} · {risk.confidence}% confidence ·{" "}
                        {evidenceTitles(evidence, risk.evidenceIds).length}{" "}
                        sources
                      </p>
                    </div>
                    <RiskBadge severity={risk.severity} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recommendations */}
          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Recommendations
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Prioritized from risks with evidence references
            </p>
            <div className="mt-5 space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {rec.rationale}
                      </p>
                      <p className="mt-2 text-[11px] text-zinc-600">
                        {rec.ownerHint ? `${rec.ownerHint} · ` : ""}
                        expected +{rec.expectedImpact} · {rec.confidence}%{" "}
                        confidence
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {evidenceTitles(evidence, rec.evidenceIds)
                          .slice(0, 3)
                          .map((src) => (
                            <span
                              key={src}
                              className="evidence-tag rounded-md px-2 py-0.5 text-[10px]"
                            >
                              {src}
                            </span>
                          ))}
                      </div>
                    </div>
                    <PriorityBadge priority={rec.priority} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Insights + Findings */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Insights
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Board-ready conclusions with source trails
            </p>
            <div className="mt-5 space-y-4">
              {insights.map((insight) => (
                <div key={insight.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{insight.conclusion}</p>
                    <span className="text-xs font-semibold text-emerald-400">
                      {insight.confidence}%
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidenceTitles(evidence, insight.evidenceIds).map((src) => (
                      <span
                        key={src}
                        className="evidence-tag rounded-md px-2 py-0.5 text-[10px]"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Findings
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Analytical claims extracted from evidence
            </p>
            <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-sm font-medium">{finding.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {finding.summary}
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-600">
                    {dimensionDisplayName(finding.dimension)} · signal{" "}
                    {Math.round(finding.signalStrength * 100)}% ·{" "}
                    {finding.confidence}% confidence
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Evidence + Connectors + Timeline */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="glass-card rounded-2xl p-6 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Connected systems
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Same EvidenceConnector contract for every source
            </p>
            <div className="mt-5 space-y-3">
              {connectorMeta.map((c) => {
                const count = evidence.filter(
                  (e) => e.connectorId === c.id,
                ).length;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${c.color}18`,
                        color: c.color,
                      }}
                    >
                      <ConnectorIcon id={c.id} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {count} evidence items
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-6 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Evidence ledger
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Normalized facts from connectors
            </p>
            <div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-white/[0.06] px-3 py-2"
                >
                  <p className="text-xs font-medium text-zinc-200">{ev.title}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {ev.connectorId}
                    {ev.dimension
                      ? ` · ${dimensionDisplayName(ev.dimension)}`
                      : ""}{" "}
                    · {ev.confidence}%
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-6 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Timeline
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pipeline activity across the company
            </p>
            <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {timeline.slice(0, 12).map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {event.kind} · {formatTime(event.occurredAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
