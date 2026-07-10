import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { company, companyDNA } from "@/lib/data";

export default function CompanyDNAPage() {
  return (
    <AppShell
      title="Company DNA"
      subtitle={`Living profile · ${company.name} · ${company.stage}`}
    >
      <div className="space-y-5">
        <div className="panel border-indigo-500/15 bg-indigo-500/5 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
            Mission
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-200">
            {companyDNA.mission}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Revenue Model
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
              {companyDNA.revenueModel}
            </p>
          </div>
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Operating Model
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
              {companyDNA.operatingModel}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Customer Segments
            </p>
            <ul className="mt-3 space-y-2">
              {companyDNA.customerSegments.map((seg) => (
                <li key={seg} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                  {seg}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Products
            </p>
            <div className="mt-3 space-y-3">
              {companyDNA.products.map((product) => (
                <div key={product.name}>
                  <p className="text-sm font-medium text-zinc-200">{product.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{product.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Top Risks
            </p>
            <ul className="mt-3 space-y-2">
              {companyDNA.topRisks.map((risk) => (
                <li key={risk} className="flex items-start gap-2 text-xs text-amber-400/90">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Key Systems Connected
            </p>
            <div className="mt-3 space-y-2">
              {companyDNA.keySystems.map((system) => (
                <div
                  key={system.name}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        system.status === "connected" ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                    />
                    <span className="text-sm text-zinc-300">{system.name}</span>
                  </div>
                  <span className="text-xs text-zinc-600">
                    {system.status === "connected"
                      ? `${system.documents} docs`
                      : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Board & Investors
            </p>
            <div className="mt-3 space-y-2">
              {companyDNA.boardAndInvestors.map((person) => (
                <div key={person.name} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{person.name}</span>
                  <span className="text-xs text-zinc-600">{person.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Key Metrics
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {companyDNA.keyMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{metric.value}</p>
                {metric.change && (
                  <p className="mt-0.5 text-[10px] text-zinc-500">{metric.change}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Important Upcoming Dates
          </p>
          <div className="mt-4 space-y-2">
            {companyDNA.upcomingDates.map((item) => (
              <div
                key={item.event}
                className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{item.event}</p>
                  <p className="text-[11px] text-zinc-500">{item.type}</p>
                </div>
                <span className="text-xs tabular-nums text-zinc-400">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/health"
            className="rounded-lg border border-[var(--border)] bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06]"
          >
            View health dimensions →
          </Link>
          <Link
            href="/timeline"
            className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15"
          >
            View health timeline →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
