"use client";

import type { HealthDimension } from "@/lib/domain";
import { HealthDimensionCard } from "./HealthDimensionCard";

interface HealthDimensionsGridProps {
  dimensions: HealthDimension[];
}

export function HealthDimensionsGrid({ dimensions }: HealthDimensionsGridProps) {
  return (
    <div className="space-y-5">
      <div className="panel border-indigo-500/15 bg-indigo-500/5 p-5">
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Each dimension is scored from evidence across your connected systems. Click any card to see why it matters, supporting evidence, and recommended actions.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dimensions.map((dimension) => (
          <HealthDimensionCard key={dimension.id} dimension={dimension} />
        ))}
      </div>
    </div>
  );
}
