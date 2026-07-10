import type { Insight } from "@/lib/domain";
import type { Finding } from "@/lib/domain";
import type { InsightSynthesisRule } from "../types";

/**
 * Stage 2: Findings → Insights
 * Groups related findings into executive-facing intelligence.
 */
export function synthesizeInsights(
  findings: Finding[],
  rules: InsightSynthesisRule[],
): Insight[] {
  const findingIds = new Set(findings.map((f) => f.id));

  return rules
    .filter((rule) => rule.findingIds.every((id) => findingIds.has(id)))
    .map((rule) => ({
      ...rule.insight,
      findingIds: rule.findingIds,
    }));
}
