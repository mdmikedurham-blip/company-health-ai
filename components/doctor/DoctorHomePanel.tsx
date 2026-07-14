"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { DoctorHomeView } from "@/lib/domain/doctor-conversation";
import { formatUsdRange } from "@/lib/value-navigator";

function DiscountList({
  title,
  items,
}: {
  title: string;
  items: NonNullable<
    DoctorHomeView["enterpriseValue"]
  >["businessDiscounts"];
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {title}
        </p>
        <p className="mt-1 text-xs text-zinc-500">None identified yet.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((d) => (
          <li key={d.id}>
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-zinc-200">{d.title}</span>
                  <span className="shrink-0 text-xs text-amber-300/90">
                    −{formatUsdRange(d.impactRange)}
                  </span>
                </div>
              </summary>
              <p className="mt-1 text-xs text-zinc-400">{d.rationale}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {d.evidenceSummary ??
                  (d.supportingEvidenceIds.length > 0
                    ? `Supported by ${d.supportingEvidenceIds.length} evidence item(s).`
                    : "Missing evidence for this factor.")}
              </p>
              <p className="mt-1 text-[11px] text-zinc-300">
                Next: {d.recommendedNextAction ?? d.whatWouldReduceIt}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DoctorHomePanel({
  initialHome,
}: {
  initialHome?: DoctorHomeView | null;
}) {
  const [home, setHome] = useState<DoctorHomeView | null>(initialHome ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback((opts?: { completeCurrent?: boolean }) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/doctor/conversation", {
          method: opts?.completeCurrent ? "POST" : "GET",
          headers: opts?.completeCurrent
            ? { "Content-Type": "application/json" }
            : undefined,
          body: opts?.completeCurrent
            ? JSON.stringify({ completeCurrent: true })
            : undefined,
        });
        const data = (await res.json()) as {
          home?: DoctorHomeView;
          error?: string;
        };
        if (!res.ok || !data.home) {
          setError(data.error ?? "Could not load Doctor conversation.");
          return;
        }
        setHome(data.home);
      } catch {
        setError("Could not load Doctor conversation.");
      }
    });
  }, []);

  useEffect(() => {
    if (!home) refresh();
  }, [home, refresh]);

  if (error && !home) {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-5 sm:px-6">
        <p className="text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-5 sm:px-6">
        <p className="text-sm text-zinc-500">Preparing Doctor…</p>
      </div>
    );
  }

  const inv = home.currentInvestigation;
  const req = home.requestedEvidence[0] ?? null;
  const action = home.nextRecommendedAction;
  const ev = home.enterpriseValue;
  const lowConfidence = (ev?.valuationConfidence ?? 0) < 70;
  const primaryCta = req ?? null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* A. Current Enterprise Value */}
        <section className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Enterprise Value Opportunity
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Based on the current evidence · ranges only
              </p>
            </div>
            {ev?.available ? (
              <p className="text-xs text-zinc-500">
                Confidence {ev.valuationConfidence}%
                {lowConfidence ? " · preliminary" : ""}
              </p>
            ) : null}
          </div>

          {!ev?.available ? (
            <div className="mt-4">
              <p className="text-base font-medium text-zinc-100">
                Preliminary valuation unavailable
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {ev?.unavailableReason ??
                  "Required financial inputs are not present."}
              </p>
              {ev?.missingUnlockInput ? (
                <p className="mt-2 text-sm text-amber-200/90">
                  The highest-value next step is to share{" "}
                  <span className="font-medium">{ev.missingUnlockInput}</span>{" "}
                  so I can unlock a preliminary estimate.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {lowConfidence ? (
                <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
                  Confidence is below 70%. Ranges are widened intentionally —
                  treat this as directional, not a precise appraisal.
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Estimated EV today
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-50">
                    {formatUsdRange(ev.currentEnterpriseValueRange!)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Potential EV
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-50">
                    {formatUsdRange(ev.potentialEnterpriseValueRange!)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    EV Opportunity
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">
                    {formatUsdRange(
                      ev.enterpriseValueOpportunityRange ?? ev.valueGapRange!,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Confidence
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-50">
                    {ev.valuationConfidence}%
                  </p>
                  <p className="text-[10px] text-zinc-500">{ev.valuationMethod}</p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* B + C — Investigation + One Next Action */}
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="space-y-3 lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Current investigation
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
              {inv?.title ?? "No open investigation"}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              {home.topObservation}
            </p>
            {inv?.businessQuestion ? (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Primary question: </span>
                {inv.businessQuestion}
              </p>
            ) : null}
            {inv?.primaryHypothesis ? (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300/80">
                  {inv.confidence < 40
                    ? "Possibility (low confidence)"
                    : "Primary hypothesis"}
                </p>
                <p className="mt-1 text-sm text-zinc-200">
                  {inv.primaryHypothesis}
                </p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Confidence {Math.round(inv.confidence)}%
                  {inv.materiality != null
                    ? ` · Materiality ${Math.round(inv.materiality)}`
                    : ""}
                </p>
              </div>
            ) : null}
            {inv?.expectedBusinessImpact ? (
              <p className="text-xs text-zinc-500">
                Why it matters: {inv.expectedBusinessImpact}
              </p>
            ) : null}
            {inv?.currentQuestion ? (
              <div className="rounded-lg border border-white/[0.06] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  One question
                </p>
                <p className="mt-1 text-sm text-zinc-200">{inv.currentQuestion}</p>
              </div>
            ) : null}
          </section>

          <section className="lg:col-span-2">
            <div className="h-full rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
                One next action
              </p>
              {primaryCta ? (
                <>
                  <p className="mt-2 text-base font-semibold text-zinc-50">
                    {primaryCta.label}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Why this matters: {primaryCta.why}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    I expect to learn: {primaryCta.expectedInsight}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-zinc-400">
                    {primaryCta.expectedConfidenceIncrease != null ? (
                      <p>
                        Expected confidence gain: ~
                        {primaryCta.expectedConfidenceIncrease}%
                      </p>
                    ) : null}
                    {primaryCta.expectedValueImpactLabel ||
                    primaryCta.estimatedValueImpact ? (
                      <p>
                        Estimated value impact:{" "}
                        {primaryCta.expectedValueImpactLabel ??
                          formatUsdRange(primaryCta.estimatedValueImpact!)}
                      </p>
                    ) : null}
                    <p>
                      Time: {primaryCta.estimatedTime ?? primaryCta.estimatedEffort}
                      {primaryCta.connectAlternative
                        ? ` · or ${primaryCta.connectAlternative}`
                        : ""}
                    </p>
                    {primaryCta.whyRanksAboveAlternatives ? (
                      <p className="text-zinc-500">
                        {primaryCta.whyRanksAboveAlternatives}
                      </p>
                    ) : null}
                  </div>
                  <a
                    href="/upload"
                    className="mt-4 inline-flex rounded-md bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/30"
                  >
                    {primaryCta.connectAlternative
                      ? "Share evidence or connect"
                      : "Share this evidence"}
                  </a>
                </>
              ) : action ? (
                <>
                  <p className="mt-2 text-base font-semibold text-zinc-50">
                    {action.title}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {action.whyItMatters ?? action.description}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-zinc-400">
                    {(action.expectedEnterpriseValueIncrease ??
                      action.estimatedValueImpact) ? (
                      <p>
                        Expected EV increase:{" "}
                        {formatUsdRange(
                          action.expectedEnterpriseValueIncrease ??
                            action.estimatedValueImpact!,
                        )}
                      </p>
                    ) : null}
                    {action.estimatedConfidenceIncrease != null ? (
                      <p>
                        Confidence improvement: ~
                        {action.estimatedConfidenceIncrease}%
                      </p>
                    ) : null}
                    {action.evidenceRequired &&
                    action.evidenceRequired.length > 0 ? (
                      <p>
                        Evidence required: {action.evidenceRequired.join(", ")}
                      </p>
                    ) : null}
                    {action.estimatedEffort ? (
                      <p>Estimated effort: {action.estimatedEffort}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => refresh({ completeCurrent: true })}
                    className="mt-4 text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                  >
                    Mark done — open next investigation
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  No single next action yet. Tell me the decision you need to
                  make this week.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* D. Why the estimate is discounted */}
        {ev?.available ? (
          <section className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Why the estimate is discounted
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Business discounts reflect company weakness. Evidence discounts
              reflect uncertainty. They are kept separate.
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <DiscountList
                title="Business discounts"
                items={ev.businessDiscounts}
              />
              <DiscountList
                title="Evidence discounts"
                items={ev.evidenceDiscounts}
              />
            </div>
            {(ev.businessDiscountRange || ev.evidenceDiscountRange) && (
              <p className="mt-4 text-xs text-zinc-500">
                The estimate is discounted because{" "}
                {ev.businessDiscounts[0]?.title
                  ? `operating issues such as ${ev.businessDiscounts[0].title.toLowerCase()}`
                  : "uncertainty in the current evidence"}
                {ev.evidenceDiscounts[0]
                  ? `, and missing evidence such as ${ev.evidenceDiscounts[0].title.toLowerCase()}`
                  : ""}
                .
              </p>
            )}
          </section>
        ) : null}

        {/* E. Alternative paths (≤3) */}
        {home.alternativePaths.length > 0 ? (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Alternative paths
            </p>
            <ul className="mt-2 space-y-2">
              {home.alternativePaths.map((alt) => (
                <li
                  key={alt.id}
                  className="flex items-start justify-between gap-3 text-sm text-zinc-400"
                >
                  <span>
                    <span className="text-zinc-300">{alt.title}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {alt.whyLowerPriority}
                    </span>
                  </span>
                  {alt.estimatedValueImpact ? (
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatUsdRange(alt.estimatedValueImpact)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* F. What changed */}
        {home.whatChanged &&
        (home.whatChanged.newFactsLearned.length > 0 ||
          home.whatChanged.confidenceDelta !== 0) ? (
          <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300/80">
              What changed
            </p>
            {home.whatChanged.newFactsLearned.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {home.whatChanged.newFactsLearned.map((t) => (
                  <li key={t} className="text-xs text-zinc-300">
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-zinc-400">
              Confidence{" "}
              {home.whatChanged.confidenceBefore != null
                ? `${Math.round(home.whatChanged.confidenceBefore)}% → `
                : ""}
              {Math.round(home.whatChanged.confidenceAfter)}%
              {home.whatChanged.confidenceDelta
                ? ` (${home.whatChanged.confidenceDelta > 0 ? "+" : ""}${Math.round(home.whatChanged.confidenceDelta)})`
                : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {home.whatChanged.valuationDeltaNote}
            </p>
          </section>
        ) : home.recentlyLearned.length > 0 ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Recently learned
            </p>
            <ul className="mt-2 space-y-1">
              {home.recentlyLearned.slice(0, 4).map((item) => (
                <li key={item.id} className="text-xs text-zinc-400">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
