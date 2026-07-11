import type { CompanyClassification } from "@/lib/domain/company-classification";

function ExpectationList({
  title,
  items,
  tone,
}: {
  title: string;
  items: CompanyClassification["missingRequired"];
  tone: "required" | "recommended" | "optional";
}) {
  if (items.length === 0) return null;
  const color =
    tone === "required"
      ? "border-red-500/25 text-red-200"
      : tone === "recommended"
        ? "border-amber-500/25 text-amber-200"
        : "border-zinc-500/25 text-zinc-300";
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={`${item.documentClass}-${item.level}`}
            className={`rounded-md border px-3 py-2 ${color}`}
          >
            <p className="text-xs font-medium">{item.label}</p>
            <p className="mt-0.5 text-[11px] opacity-80">{item.whyItMatters}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhatToUploadNextPanel({
  classification,
  classifying,
}: {
  classification: CompanyClassification | null;
  classifying: boolean;
}) {
  if (classifying || !classification) {
    return (
      <section className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">What to upload next</h2>
        <p className="text-sm text-zinc-500">
          Available after company classification. Start with formation docs,
          product notes, or any financial/customer evidence you already have.
        </p>
      </section>
    );
  }

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">What to upload next</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Expectations for {classification.stage} · coverage{" "}
            {classification.evidenceCoveragePct}%
          </p>
        </div>
        <span className="text-[11px] text-zinc-500">
          Health{" "}
          {classification.healthScoreAvailable ? "ready when scored" : "unavailable"}
        </span>
      </div>

      <ExpectationList
        title="Missing required"
        items={classification.missingRequired}
        tone="required"
      />
      <ExpectationList
        title="Recommended"
        items={classification.missingRecommended}
        tone="recommended"
      />
      <ExpectationList
        title="Optional"
        items={classification.optionalRemaining.slice(0, 6)}
        tone="optional"
      />

      {classification.missingRequired.length === 0 &&
      classification.missingRecommended.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Required and recommended evidence for this stage looks covered.
        </p>
      ) : null}
    </section>
  );
}
