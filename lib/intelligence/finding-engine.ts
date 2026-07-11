/**
 * Finding Engine — Insights → Findings.
 * Groups insights by ruleId / findingId using FINDING_POLICY from rules.ts.
 */

import type { Evidence, Finding, Insight } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";
import {
  FINDING_POLICY,
  SECURITY_RULE_IDS,
  type FindingPolicy,
  type RuleId,
} from "./rules";

function primarySource(evidence: Evidence[], evidenceIds: string[]): string {
  const first = evidence.find((e) => evidenceIds.includes(e.id));
  return first?.sourceSystem ?? "Unknown";
}

function collectedAt(evidence: Evidence[], evidenceIds: string[]): string {
  const first = evidence.find((e) => evidenceIds.includes(e.id));
  return first?.collectedAt ?? "Unknown";
}

function makeFinding(
  policy: FindingPolicy,
  insights: Insight[],
  evidence: Evidence[],
): Finding {
  const evidenceIds = [...new Set(insights.flatMap((i) => i.evidenceIds))];
  const confidence = Math.round(
    insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length,
  );
  const description = insights.map((i) => i.statement).join(" ");

  return {
    id: policy.findingId,
    title: policy.title,
    description,
    dimensionId: policy.dimensionId,
    dimension: dimensionName(policy.dimensionId),
    insightIds: insights.map((i) => i.id),
    evidenceIds,
    direction: policy.direction,
    materiality: policy.materiality,
    confidence,
    scoreImpact: policy.scoreImpact,
    summary: description,
    extractedAt: collectedAt(evidence, evidenceIds),
    sourceSystem: primarySource(evidence, evidenceIds),
  };
}

function isRuleId(value: string): value is RuleId {
  return value in FINDING_POLICY;
}

/**
 * Convert insights into findings using structured ruleId (never statement text).
 */
export function deriveFindings(insights: Insight[], evidence: Evidence[]): Finding[] {
  const byRule = new Map<RuleId, Insight[]>();
  for (const insight of insights) {
    if (!isRuleId(insight.ruleId)) continue;
    const list = byRule.get(insight.ruleId) ?? [];
    list.push(insight);
    byRule.set(insight.ruleId, list);
  }

  const findings: Finding[] = [];
  const emittedFindingIds = new Set<string>();

  // Concentration: prefer high over medium when both present
  if (byRule.has("concentration-high")) {
    findings.push(
      makeFinding(
        FINDING_POLICY["concentration-high"],
        byRule.get("concentration-high")!,
        evidence,
      ),
    );
    emittedFindingIds.add("finding-concentration");
  } else if (byRule.has("concentration-medium")) {
    findings.push(
      makeFinding(
        FINDING_POLICY["concentration-medium"],
        byRule.get("concentration-medium")!,
        evidence,
      ),
    );
    emittedFindingIds.add("finding-concentration");
  }

  // Runway: prefer most severe band
  if (byRule.has("runway-high")) {
    findings.push(
      makeFinding(FINDING_POLICY["runway-high"], byRule.get("runway-high")!, evidence),
    );
    emittedFindingIds.add("finding-runway");
  } else if (byRule.has("runway-medium")) {
    findings.push(
      makeFinding(
        FINDING_POLICY["runway-medium"],
        byRule.get("runway-medium")!,
        evidence,
      ),
    );
    emittedFindingIds.add("finding-runway");
  } else if (byRule.has("runway-positive")) {
    findings.push(
      makeFinding(
        FINDING_POLICY["runway-positive"],
        byRule.get("runway-positive")!,
        evidence,
      ),
    );
    emittedFindingIds.add("finding-runway");
  }

  // Security: merge critical-controls + mfa into one finding
  const securityInsights = SECURITY_RULE_IDS.flatMap((id) => byRule.get(id) ?? []);
  if (securityInsights.length > 0) {
    const base = FINDING_POLICY["critical-controls"];
    const materiality = Math.max(
      ...securityInsights.map((i) => FINDING_POLICY[i.ruleId as RuleId].materiality),
    );
    const scoreImpact = Math.min(
      ...securityInsights.map((i) => FINDING_POLICY[i.ruleId as RuleId].scoreImpact),
    );
    findings.push(
      makeFinding(
        { ...base, materiality, scoreImpact },
        securityInsights,
        evidence,
      ),
    );
    emittedFindingIds.add(base.findingId);
    for (const id of SECURITY_RULE_IDS) byRule.delete(id);
  }

  // Remaining single-rule findings
  const remaining: RuleId[] = [
    "ip-gap",
    "board-approval",
    "recurring-revenue",
    "nrr",
    "low-attrition",
    "key-person",
    "financial-metrics",
  ];
  for (const ruleId of remaining) {
    const group = byRule.get(ruleId);
    if (!group || group.length === 0) continue;
    const policy = FINDING_POLICY[ruleId];
    if (emittedFindingIds.has(policy.findingId)) continue;
    findings.push(makeFinding(policy, group, evidence));
    emittedFindingIds.add(policy.findingId);
  }

  for (const finding of findings) {
    for (const insight of insights) {
      if (finding.insightIds.includes(insight.id)) {
        insight.findingIds = [...new Set([...insight.findingIds, finding.id])];
      }
    }
  }

  return findings;
}
