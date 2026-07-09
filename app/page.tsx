import Link from "next/link";
import { StatusBadge, RiskBadge } from "@/components/Badges";
import { ConnectorIcon } from "@/components/ConnectorIcon";
import { CONNECTOR_CATALOG, HEALTH_DIMENSIONS } from "@/lib/domain";
import { loadCompanyDNA } from "@/lib/company/load-company-dna";
import { evidenceTitles } from "@/lib/insight-engine";

const useCases = [
  {
    role: "Board Members",
    title: "Prepared for every board meeting",
    description:
      "Walk into quarterly reviews with a unified health score, risk radar, and evidence-backed talking points—synthesized from every system your company runs on.",
    features: ["Pre-meeting health briefs", "Risk trend alerts", "Dimension scorecards"],
  },
  {
    role: "Investors",
    title: "Diligence without the drag",
    description:
      "Get continuous portfolio visibility instead of quarterly snapshots. Spot deterioration early and validate growth claims against source documents.",
    features: ["Portfolio health monitoring", "Source-linked metrics", "Comparative benchmarks"],
  },
  {
    role: "Founders",
    title: "Know your blind spots",
    description:
      "Ask Company Doctor anything about your business health. Get honest, cited answers pulled from your actual financial, legal, and operational data.",
    features: ["Natural language queries", "Actionable recommendations", "Zero manual reporting"],
  },
];

export default async function Home() {
  const dna = await loadCompanyDNA();
  const { health, risks, insights, evidence, recommendations } = dna;
  const overallScore = health.overall;
  const topRisks = risks.slice(0, 6);
  const topInsights = insights.slice(0, 3);
  const topRecs = recommendations.filter((r) => r.priority === "p0" || r.priority === "p1").slice(0, 3);
  const availableConnectors = CONNECTOR_CATALOG.filter((c) => c.status === "available");

  const runwayFinding = dna.findings.find((f) => f.id === "find-runway");
  const doctorSources = runwayFinding
    ? evidenceTitles(evidence, runwayFinding.evidenceIds)
    : evidence.slice(0, 3).map((e) => e.title);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="glow-orb animate-pulse-glow absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 bg-indigo-600/20" />
      <div className="glow-orb absolute top-1/3 -right-48 h-[400px] w-[400px] bg-violet-600/10" />
      <div className="glow-orb absolute bottom-0 -left-48 h-[350px] w-[350px] bg-blue-600/10" />

      <nav className="relative z-50 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-500/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Company Health AI</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#dashboard" className="transition-colors hover:text-white">Dashboard</a>
            <a href="#connectors" className="transition-colors hover:text-white">Connectors</a>
            <a href="#dimensions" className="transition-colors hover:text-white">Dimensions</a>
            <Link href="/dashboard" className="transition-colors hover:text-white">Intelligence</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-lg px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white sm:block"
            >
              Open platform
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative px-6 pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            Free AI intelligence layer for your company
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            <span className="gradient-text">How healthy</span>
            <br />
            is this company?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Company Health AI connects to Google Drive, Box, QuickBooks, Carta, HubSpot, and your other systems—then delivers a real-time health score with evidence-backed conclusions.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-400 sm:w-auto"
            >
              Connect your systems
            </Link>
            <a
              href="#dashboard"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-zinc-200 transition-all hover:border-white/20 hover:bg-white/[0.08] sm:w-auto"
            >
              See live intelligence
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Free forever · No credit card · Read-only access</p>
        </div>
      </section>

      <section id="dashboard" className="relative px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Health Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              One view of company health
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Computed by the Insight Engine from {evidence.length} evidence items across {dna.connectedSystems.length} connectors
            </p>
          </div>

          <div className="glass-card animate-float overflow-hidden rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-sm text-zinc-500">
                  {dna.companyName} · Health Overview
                </span>
              </div>
              <Link href="/dashboard" className="text-xs text-indigo-400 hover:text-indigo-300">
                Open full intelligence →
              </Link>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[280px_1fr]">
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="relative">
                  <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(overallScore / 100) * 327} 327`}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{overallScore}</span>
                    <span className="text-xs text-zinc-500">/ 100</span>
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-300">Overall Health</p>
                <StatusBadge status={health.status} />
              </div>

              <div className="space-y-3">
                {health.dimensions.map((dim) => (
                  <div key={dim.id} className="flex items-center gap-4">
                    <span className="w-32 shrink-0 text-sm text-zinc-400">{dim.name}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="dimension-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-medium tabular-nums">{dim.score}</span>
                    <StatusBadge status={dim.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-6xl" />

      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Company Doctor</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Ask anything about your company&apos;s health
              </h2>
              <p className="mt-4 leading-relaxed text-zinc-400">
                Company Doctor reads across all connected systems and answers in plain language—with citations to the source documents that support every claim.
              </p>
              <ul className="mt-6 space-y-3">
                {(dna.findings.slice(0, 3).map((f) => f.title)).map((q) => (
                  <li key={q} className="flex items-start gap-2 text-sm text-zinc-400">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v1a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1H6a2 2 0 01-2-2v-1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Company Doctor</p>
                  <p className="text-xs text-zinc-500">Grounded in Insight Engine findings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="chat-bubble-user max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm text-white">
                    What&apos;s our actual runway given current burn and the new hires in Q3?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="chat-bubble-ai max-w-[90%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed text-zinc-300">
                    <p>
                      {runwayFinding?.summary ??
                        "Runway analysis is derived from connected financial evidence."}
                    </p>
                    {topRecs[0] && (
                      <p className="mt-2">
                        Recommended: {topRecs[0].title} ({topRecs[0].confidence}% confidence).
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {doctorSources.map((src) => (
                        <span key={src} className="evidence-tag rounded-md px-2 py-0.5 text-xs">
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <input
                  type="text"
                  readOnly
                  value="Ask Company Doctor anything..."
                  className="flex-1 bg-transparent text-sm text-zinc-500 outline-none"
                />
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Open
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="connectors" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Connectors</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Plug into the systems you already use
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Read-only integrations populate the same Evidence pipeline. New connectors never require UI changes.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableConnectors.map((c) => (
              <div
                key={c.id}
                className="connector-icon group rounded-xl p-6 transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${c.color}18`, color: c.color }}
                >
                  <ConnectorIcon id={c.id} />
                </div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{c.description}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {dna.connectedSystems.includes(c.id)
                    ? `Connected · ${evidence.filter((e) => e.connectorId === c.id).length} evidence`
                    : "Read-only · OAuth secure"}
                </div>
              </div>
            ))}
            <div className="connector-icon flex flex-col items-center justify-center rounded-xl border-dashed p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 className="font-semibold text-zinc-400">More coming soon</h3>
              <p className="mt-1 text-sm text-zinc-600">Stripe, Gusto, Salesforce, and more</p>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-6xl" />

      <section id="dimensions" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Health Dimensions</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Eight dimensions of company health
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              A comprehensive framework that covers every angle investors and boards care about.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HEALTH_DIMENSIONS.map((dim) => (
              <div key={dim.id} className="glass-card rounded-xl p-5 transition-all hover:border-white/15">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={dim.iconPath} />
                  </svg>
                </div>
                <h3 className="font-semibold">{dim.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{dim.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="glass-card flex items-center justify-center rounded-2xl p-8">
              <svg viewBox="0 0 240 240" className="h-64 w-64 md:h-80 md:w-80">
                {[20, 40, 60, 80].map((r) => (
                  <polygon
                    key={r}
                    className="radar-grid"
                    points={[0, 1, 2, 3, 4, 5, 6, 7]
                      .map((i) => {
                        const angle = (i * Math.PI) / 4 - Math.PI / 2;
                        const x = 120 + r * Math.cos(angle);
                        const y = 120 + r * Math.sin(angle);
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                ))}
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const angle = (i * Math.PI) / 4 - Math.PI / 2;
                  return (
                    <line
                      key={i}
                      className="radar-grid"
                      x1="120"
                      y1="120"
                      x2={120 + 80 * Math.cos(angle)}
                      y2={120 + 80 * Math.sin(angle)}
                    />
                  );
                })}
                <polygon
                  className="radar-polygon"
                  points={health.dimensions
                    .map((d, i) => {
                      const angle = (i * Math.PI) / 4 - Math.PI / 2;
                      const r = (d.score / 100) * 80;
                      const x = 120 + r * Math.cos(angle);
                      const y = 120 + r * Math.sin(angle);
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                {health.dimensions.map((d, i) => {
                  const angle = (i * Math.PI) / 4 - Math.PI / 2;
                  const x = 120 + 98 * Math.cos(angle);
                  const y = 120 + 98 * Math.sin(angle);
                  return (
                    <text
                      key={d.id}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-zinc-400 text-[9px] font-medium"
                    >
                      {d.name.split(" ")[0]}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Risk Radar</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Surface risks before they surface themselves
              </h2>
              <p className="mt-4 leading-relaxed text-zinc-400">
                Risks are derived from findings, which are derived from evidence—each with severity, health impact, and linked sources.
              </p>

              <div className="mt-8 space-y-3">
                {topRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{risk.label}</p>
                      <p className="text-xs text-zinc-500">{risk.detail}</p>
                    </div>
                    <RiskBadge severity={risk.severity} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-6xl" />

      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Evidence-Backed</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Every conclusion links to source documents
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              No black-box scores. Every insight traces back to the exact file, spreadsheet, or record that supports it.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {topInsights.map((item) => (
              <div key={item.id} className="glass-card rounded-xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Insight</span>
                  <span className="text-sm font-semibold text-emerald-400">{item.confidence}% confidence</span>
                </div>
                <p className="text-lg font-medium leading-snug">{item.conclusion}</p>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Sources</p>
                  {evidenceTitles(evidence, item.evidenceIds).map((src) => (
                    <div key={src} className="flex items-center gap-2 text-sm text-zinc-400">
                      <svg className="h-3.5 w-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {src}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">Use Cases</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Built for boards, investors, and founders
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {useCases.map((uc) => (
              <div key={uc.role} className="glass-card flex flex-col rounded-xl p-6">
                <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{uc.role}</span>
                <h3 className="mt-2 text-xl font-semibold">{uc.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{uc.description}</p>
                <ul className="mt-6 space-y-2">
                  {uc.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-transparent to-violet-500/10 px-8 py-16 text-center md:px-16">
            <div className="glow-orb absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 bg-indigo-500/20" />
            <h2 className="relative text-3xl font-semibold tracking-tight md:text-4xl">
              Start measuring company health today
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-zinc-400">
              Connect your systems in minutes. Get your first health score and risk radar—for free, forever.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className="w-full rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 sm:w-auto"
              >
                Get started free
              </Link>
              <Link
                href="/dashboard"
                className="w-full rounded-xl border border-white/15 px-8 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/[0.05] sm:w-auto"
              >
                View intelligence platform
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-500/30">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-medium">Company Health AI</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Company Health AI. Free AI intelligence for company health.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <a href="#" className="transition-colors hover:text-zinc-300">Privacy</a>
            <a href="#" className="transition-colors hover:text-zinc-300">Terms</a>
            <a href="#" className="transition-colors hover:text-zinc-300">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
