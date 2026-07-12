"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { DoctorHomeView } from "@/lib/domain/doctor-conversation";

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
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-6">
        <p className="text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-6">
        <p className="text-sm text-zinc-500">Preparing Doctor…</p>
      </div>
    );
  }

  const inv = home.currentInvestigation;
  const req = home.requestedEvidence[0];
  const action = home.nextRecommendedAction;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Current investigation
          </p>
          <h2 className="text-lg font-semibold text-zinc-100">
            {inv?.title ?? "No open investigation"}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            {home.topObservation}
          </p>
          <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {home.mentorMessage}
          </p>
          {inv?.currentQuestion ? (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300/80">
                One high-value question
              </p>
              <p className="mt-1 text-sm text-zinc-200">{inv.currentQuestion}</p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="rounded-lg border border-[var(--border)] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Current confidence
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {Math.round(home.currentConfidence)}%
            </p>
            <p className="text-[11px] text-zinc-500">
              Phase: {home.workflowPhase.replace(/_/g, " ")}
            </p>
          </div>

          {action ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
                Next recommended action
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-100">
                {action.title}
              </p>
              <p className="mt-1 text-xs text-zinc-400">{action.description}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => refresh({ completeCurrent: true })}
                className="mt-2 text-xs font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
              >
                Mark done — open next investigation
              </button>
            </div>
          ) : null}

          {req ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/80">
                Requested evidence
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-100">{req.label}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Why this matters: {req.why}
              </p>
              {req.expectedValueImpactLabel ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Expected value impact: {req.expectedValueImpactLabel}
                </p>
              ) : null}
              {req.expectedConfidenceIncrease != null ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Expected confidence increase: ~{req.expectedConfidenceIncrease}%
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">
                  Expected: {req.expectedInsight}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                Estimated time: {req.estimatedTime ?? req.estimatedEffort}
                {req.connectAlternative
                  ? ` · or ${req.connectAlternative}`
                  : ""}
              </p>
              <a
                href="/upload"
                className="mt-2 inline-block text-xs font-medium text-amber-300 hover:text-amber-200"
              >
                Share evidence
              </a>
            </div>
          ) : null}
        </section>
      </div>

      {home.recentlyLearned.length > 0 ? (
        <div className="mx-auto mt-4 max-w-5xl">
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
        </div>
      ) : null}

      {error ? (
        <p className="mx-auto mt-3 max-w-5xl text-xs text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
