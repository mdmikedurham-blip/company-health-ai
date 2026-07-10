import type { Evidence } from "@/lib/domain";
import type { Finding, Risk } from "@/lib/domain";
import type { RawEvidence } from "../types";

/**
 * Backfill bidirectional links on evidence after pipeline stages complete.
 */
export function linkEvidence(
  rawEvidence: RawEvidence[],
  findings: Finding[],
  risks: Risk[],
): Evidence[] {
  return rawEvidence.map((item) => ({
    ...item,
    findingIds: findings
      .filter((f) => f.evidenceIds.includes(item.id))
      .map((f) => f.id),
    linkedRiskIds: risks
      .filter((r) => r.evidenceIds.includes(item.id))
      .map((r) => r.id),
  }));
}
