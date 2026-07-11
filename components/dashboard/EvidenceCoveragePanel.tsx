"use client";

import Link from "next/link";
import type { EvidenceCoverageReport } from "@/lib/domain/evidence-coverage";

function pctLabel(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

function levelTone(level: string): string {
  switch (level) {
    case "required":
      return "text-amber-300";
    case "recommended":
      return "text-sky-300";
    case "optional":
      return "text-zinc-500";
    default:
      return "text-zinc-600";
  }
}

export function EvidenceCoveragePanel({
  coverage,
}: {
  coverage: EvidenceCoverageReport;
}) {
  const stageLabel = coverage.stage ?? "Stage not classified yet";

  return (
    <section className="panel space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Evidence coverage
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            Diligence completeness before health
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Stage: {stageLabel}
            {coverage.evidenceCount > 0
              ? ` · ${coverage.evidenceCount} evidence items`
              : " · upload documents to start"}
          </p>
        </div>
        <Link
          href="/upload"
          className="text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          Upload missing evidence →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Coverage"
          value={pctLabel(coverage.coveragePct)}
          hint="All applicable items"
        />
        <Metric
          label="Required complete"
          value={pctLabel(coverage.requiredCompletePct)}
          hint={`${coverage.requiredComplete}/${coverage.requiredTotal}`}
        />
        <Metric
          label="Recommended complete"
          value={pctLabel(coverage.recommendedCompletePct)}
          hint={`${coverage.recommendedComplete}/${coverage.recommendedTotal}`}
        />
        <Metric
          label="Missing required"
          value={String(coverage.missingRequired.length)}
          hint={
            coverage.missingRecommended.length > 0
              ? `${coverage.missingRecommended.length} recommended gaps`
              : "No recommended gaps"
          }
          alert={coverage.missingRequired.length > 0}
        />
      </div>

      <div className="space-y-4">
        {coverage.categories.map((cat) => {
          const applicable = cat.items.filter(
            (i) => i.level !== "not_applicable",
          );
          if (applicable.length === 0) return null;
          return (
            <div key={cat.categoryId} className="border-t border-zinc-800 pt-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-200">
                  {cat.label}
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {pctLabel(cat.coveragePct)} · {cat.requiredComplete}/
                  {cat.requiredTotal} required
                </span>
              </div>
              <ul className="space-y-2">
                {applicable.map((item) => (
                  <li
                    key={item.itemId}
                    className="flex flex-wrap items-start justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            item.uploaded ? "text-emerald-300" : "text-zinc-300"
                          }
                        >
                          {item.uploaded ? "●" : "○"} {item.label}
                        </span>
                        <span
                          className={`uppercase tracking-wide ${levelTone(item.level)}`}
                        >
                          {item.level}
                        </span>
                        {item.uploaded && item.verified ? (
                          <span className="text-emerald-500/80">verified</span>
                        ) : null}
                        {item.uploaded && !item.verified ? (
                          <span className="text-amber-500/80">uploaded</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                        {item.whyItMatters}
                        {item.supportingDocuments.length > 0
                          ? ` · ${item.supportingDocuments
                              .slice(0, 2)
                              .map((d) => d.title)
                              .join(", ")}`
                          : null}
                        {item.lastUpdated
                          ? ` · updated ${item.lastUpdated.slice(0, 10)}`
                          : null}
                        {item.uploaded
                          ? ` · confidence ${Math.round(item.confidence * 100)}%`
                          : null}
                      </p>
                    </div>
                    {item.missing ? (
                      <span className="shrink-0 text-[11px] text-amber-300/90">
                        Missing
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {(coverage.missingRequired.length > 0 ||
        coverage.missingRecommended.length > 0) && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Gaps to close
          </p>
          {coverage.missingRequired.length > 0 ? (
            <p className="mt-2 text-xs text-amber-200">
              Required:{" "}
              {coverage.missingRequired.map((i) => i.label).join(", ")}
            </p>
          ) : null}
          {coverage.missingRecommended.length > 0 ? (
            <p className="mt-1 text-xs text-zinc-400">
              Recommended:{" "}
              {coverage.missingRecommended
                .slice(0, 8)
                .map((i) => i.label)
                .join(", ")}
              {coverage.missingRecommended.length > 8
                ? ` +${coverage.missingRecommended.length - 8} more`
                : ""}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          alert ? "text-amber-300" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}
