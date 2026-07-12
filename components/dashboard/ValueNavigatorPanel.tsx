"use client";

import Link from "next/link";
import type { ValueNavigatorView } from "@/lib/domain/value-navigator";
import { formatUsdRange } from "@/lib/value-navigator";

export function ValueNavigatorPanel({
  view,
}: {
  view: ValueNavigatorView | null | undefined;
}) {
  if (!view) {
    return (
      <div className="panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Enterprise Value
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Share financial evidence to estimate today&apos;s enterprise value
          range, potential, and the value gap.
        </p>
      </div>
    );
  }

  const { navigator, timeline } = view;
  const topDrivers = navigator.drivers.slice(0, 5);
  const current = navigator.currentEstimatedEnterpriseValueRange;
  const potential = navigator.potentialEnterpriseValueRange;
  const gap = navigator.valueGap;
  const hasEstimate = current.high > 0 || potential.high > 0;

  return (
    <div className="space-y-4">
      {/* Card 1 — Enterprise Value */}
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Enterprise Value
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Ranges only · {navigator.valuationMethod} · confidence{" "}
              {navigator.valuationConfidence}%
            </p>
          </div>
          <Link
            href="/doctor"
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
          >
            Ask Doctor →
          </Link>
        </div>

        {hasEstimate ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Today
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {formatUsdRange(current)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Potential
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {formatUsdRange(potential)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Value Gap
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {formatUsdRange(gap)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Confidence
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {navigator.valuationConfidence}%
              </p>
              <p className="text-[10px] text-zinc-500">
                P(potential) {navigator.probabilityOfAchievingPotential}%
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Insufficient inputs for an enterprise value range. Missing:{" "}
            {navigator.missingInputs.join(", ") || "financial facts"}.
          </p>
        )}

        {navigator.assumptions.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] text-zinc-500">
              Assumptions &amp; explainability
            </summary>
            <ul className="mt-2 space-y-1">
              {navigator.assumptions.slice(0, 6).map((a) => (
                <li key={a.id} className="text-xs text-zinc-400">
                  {a.statement}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 2 — Top 5 Value Drivers */}
        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Top Value Drivers
          </p>
          {topDrivers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No ranked drivers yet — add financial evidence.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {topDrivers.map((d, i) => (
                <li key={d.id} className="border-b border-white/[0.04] pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      <span className="text-zinc-500">{i + 1}. </span>
                      {d.title}
                    </p>
                    <p className="shrink-0 text-xs text-emerald-300">
                      {formatUsdRange(d.estimatedValueImpact)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                    {d.businessRationale}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {d.currentMetric
                      ? `Current ${d.currentMetric}`
                      : "Current unknown"}
                    {d.targetMetric ? ` → Target ${d.targetMetric}` : ""}
                    {" · "}
                    Confidence {d.confidence}% · {d.difficulty} · {d.estimatedTime}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {/* Card 3 — Current Investigation (Doctor link) */}
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Current Investigation
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {navigator.doctorPriorityMessage}
            </p>
            <Link
              href="/doctor"
              className="mt-3 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Open Company Doctor →
            </Link>
          </div>

          {/* Card 4 — Highest ROI Action */}
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Highest ROI Action
            </p>
            {navigator.highestRoiAction ? (
              <>
                <p className="mt-2 text-sm font-medium text-zinc-100">
                  {navigator.highestRoiAction.title}
                </p>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-3">
                  {navigator.highestRoiAction.rationale}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                No action ranked yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card 5 — Value Timeline */}
      <div className="panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Value Timeline
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Evidence quality improves valuation confidence over time.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium">Est. EV (mid)</th>
                <th className="pb-2 font-medium">Coverage</th>
                <th className="pb-2 font-medium">Confidence</th>
                <th className="pb-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => (
                <tr key={row.label} className="border-t border-white/[0.04]">
                  <td className="py-2 text-zinc-300">{row.label}</td>
                  <td className="py-2 text-zinc-300">
                    {row.enterpriseValueMid != null
                      ? formatUsdRange({
                          low: row.enterpriseValueMid,
                          high: row.enterpriseValueMid,
                          currency: "USD",
                        })
                      : "—"}
                  </td>
                  <td className="py-2 text-zinc-400">
                    {row.coverage != null ? `${Math.round(row.coverage)}%` : "—"}
                  </td>
                  <td className="py-2 text-zinc-400">{row.confidence}%</td>
                  <td className="py-2 text-zinc-400">
                    {row.health != null ? row.health : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {navigator.evidenceRequest ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/80">
            Requested evidence
          </p>
          <p className="mt-1 text-sm text-zinc-100">
            {navigator.evidenceRequest.label}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Why this matters: {navigator.evidenceRequest.why}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-500">
            {navigator.evidenceRequest.expectedValueImpact ? (
              <span>
                Expected value impact:{" "}
                {formatUsdRange(navigator.evidenceRequest.expectedValueImpact)}
              </span>
            ) : null}
            <span>
              Expected confidence +
              {navigator.evidenceRequest.expectedConfidenceIncrease}%
            </span>
            <span>Est. time: {navigator.evidenceRequest.estimatedTime}</span>
          </div>
          <Link
            href="/upload"
            className="mt-2 inline-block text-xs font-medium text-amber-300 hover:text-amber-200"
          >
            Share evidence →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
