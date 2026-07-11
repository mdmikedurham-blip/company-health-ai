"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AssessmentGoalDashboardContext } from "@/lib/domain/assessment-goal";

export function AssessmentGoalCard({
  assessmentGoal,
}: {
  assessmentGoal: AssessmentGoalDashboardContext;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(assessmentGoal);

  async function onChangeGoal(goal: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/company/assessment-goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
        });
        const data = (await res.json()) as {
          assessmentGoal?: AssessmentGoalDashboardContext;
          error?: string;
        };
        if (!res.ok || !data.assessmentGoal) {
          setError(data.error ?? "Could not update assessment goal.");
          return;
        }
        setLocal(data.assessmentGoal);
        router.refresh();
      } catch {
        setError("Could not update assessment goal.");
      }
    });
  }

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Assessment Goal
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            Current Goal
          </h2>
          <p className="mt-2 text-base font-medium text-emerald-300">
            {local.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-500">Purpose: </span>
            {local.purpose}
          </p>
        </div>
        <label className="block shrink-0 text-[11px] text-zinc-500">
          Change goal
          <select
            className="mt-1 block min-w-[12rem] rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            value={local.goal}
            disabled={pending}
            onChange={(e) => void onChangeGoal(e.target.value)}
          >
            {local.availableGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {local.operatingLenses.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {local.operatingLenses.map((lens) => (
            <div
              key={lens.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                {lens.title}
              </p>
              <p className="mt-1 text-xs leading-snug text-zinc-400">
                {lens.question}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-600">
                Placeholder
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {local.uploadPriorities.length > 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Upload priorities
          </p>
          <ul className="mt-2 space-y-1.5">
            {local.uploadPriorities.map((item) => (
              <li key={item.label} className="text-xs text-zinc-400">
                <span className="text-zinc-200">{item.label}</span>
                <span className="text-zinc-600"> · {item.level}</span>
                <span className="block text-[11px] text-zinc-500">
                  {item.why}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Upload priorities for this goal will appear in a later phase.
        </p>
      )}
    </section>
  );
}
