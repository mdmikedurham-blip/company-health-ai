"use client";

import { useState, useTransition } from "react";
import type { CompanyClassification } from "@/lib/domain/company-classification";
import { COMPANY_LIFECYCLE_STAGES } from "@/lib/domain/company-classification";

const REVENUE_OPTIONS = [
  "none",
  "pre-revenue",
  "under-1m",
  "1m-10m",
  "10m-plus",
  "unknown",
] as const;

const EMPLOYEE_OPTIONS = [
  "1-5",
  "6-20",
  "21-50",
  "51-200",
  "200-plus",
  "unknown",
] as const;

const FUNDING_OPTIONS = [
  "bootstrapped",
  "friends-family",
  "pre-seed",
  "seed",
  "series-a-plus",
  "unknown",
] as const;

export function CompanyProfilePanel({
  classification,
  classifying,
}: {
  classification: CompanyClassification | null;
  classifying: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [stage, setStage] = useState(classification?.stage ?? "");
  const [revenue, setRevenue] = useState<string>(
    classification?.annualRevenueRange ?? "unknown",
  );
  const [employees, setEmployees] = useState<string>(
    classification?.employeeCountRange ?? "unknown",
  );
  const [funding, setFunding] = useState<string>(
    classification?.fundingStatus ?? "unknown",
  );
  const [boardPresent, setBoardPresent] = useState<string>(
    classification?.boardPresent == null
      ? ""
      : classification.boardPresent
        ? "yes"
        : "no",
  );

  function confirm() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/company/classification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stage || undefined,
          annualRevenueRange: revenue || undefined,
          employeeCountRange: employees || undefined,
          fundingStatus: funding || undefined,
          boardPresent:
            boardPresent === ""
              ? undefined
              : boardPresent === "yes",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save confirmation.");
        return;
      }
      setSaved(true);
    });
  }

  if (classifying || !classification) {
    return (
      <section className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Company Profile</h2>
        <p className="text-sm text-amber-300/90">Classifying company…</p>
        <p className="text-xs text-zinc-500">
          Upload documents so we can infer stage and evidence expectations.
          Overall health stays unavailable until classification completes.
        </p>
      </section>
    );
  }

  const keyFacts = [
    classification.annualRevenueRange !== "unknown"
      ? `Revenue: ${classification.annualRevenueRange}`
      : null,
    classification.employeeCountRange !== "unknown"
      ? `Employees: ${classification.employeeCountRange}`
      : null,
    classification.fundingStatus !== "unknown"
      ? `Funding: ${classification.fundingStatus}`
      : null,
    classification.outsideInvestors != null
      ? `Outside investors: ${classification.outsideInvestors ? "yes" : "no"}`
      : null,
    classification.boardPresent != null
      ? `Board present: ${classification.boardPresent ? "yes" : "no"}`
      : null,
  ].filter(Boolean);

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Company Profile</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Stage-aware due diligence classification from persisted evidence
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] tabular-nums text-zinc-400">
          {Math.round(classification.confidence)}% confidence
        </span>
      </div>

      <div>
        <p className="text-lg font-semibold text-emerald-300">
          {classification.stage ?? "Unknown stage"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {classification.inferenceRationale}
        </p>
      </div>

      {keyFacts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {keyFacts.map((fact) => (
            <li
              key={fact!}
              className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-zinc-300"
            >
              {fact}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="text-[11px] text-zinc-500">
        Evidence used: {classification.sourceEvidenceIds.length} document
        {classification.sourceEvidenceIds.length === 1 ? "" : "s"}
        {classification.snapshotId
          ? ` · snapshot ${classification.snapshotId.slice(0, 8)}…`
          : ""}
      </div>

      {classification.assumptions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Assumptions needing confirmation
          </p>
          {classification.assumptions.map((a) => (
            <p key={a.field} className="text-xs text-amber-200/80">
              {a.statement}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
          Stage
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value="">Keep inferred</option>
            {COMPANY_LIFECYCLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
          Revenue range
          <select
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"
          >
            {REVENUE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
          Employee count
          <select
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"
          >
            {EMPLOYEE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
          Funding status
          <select
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"
          >
            {FUNDING_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
          Board present
          <select
            value={boardPresent}
            onChange={(e) => setBoardPresent(e.target.value)}
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value="">Unspecified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm corrections"}
        </button>
        {saved ? (
          <span className="text-xs text-emerald-400">Saved — overrides preserved</span>
        ) : null}
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    </section>
  );
}
