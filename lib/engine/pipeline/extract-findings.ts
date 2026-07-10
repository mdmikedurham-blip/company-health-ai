import type { Finding } from "@/lib/domain";
import type { EvidenceId } from "@/lib/domain";
import type { FindingExtractionRule, RawEvidence } from "../types";

/**
 * Stage 1: Evidence → Findings
 * Applies extraction rules to raw connector documents.
 */
export function extractFindings(
  evidence: RawEvidence[],
  rules: FindingExtractionRule[],
): Finding[] {
  const evidenceIds = new Set(evidence.map((e) => e.id));

  return rules
    .filter((rule) => evidenceIds.has(rule.evidenceId))
    .map((rule) => ({
      ...rule.finding,
      evidenceIds: [rule.evidenceId] as EvidenceId[],
    }));
}
