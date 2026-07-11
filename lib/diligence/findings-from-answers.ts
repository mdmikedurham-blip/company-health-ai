/**
 * Findings are generated from answered diligence questions — not documents.
 */

import type { Evidence, Finding } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";
import type { AnswerEvaluation } from "./answer-engine";
import {
  FINDING_POLICY,
  type RuleId,
} from "@/lib/intelligence/rules";

function isRuleId(value: string): value is RuleId {
  return value in FINDING_POLICY;
}

/**
 * Collapse question evaluations that carry findingRuleId into Findings
 * using the shared FINDING_POLICY (same impacts as the legacy insight path).
 */
export function deriveFindingsFromAnswers(
  evaluations: Map<string, AnswerEvaluation>,
  evidence: Evidence[],
): Finding[] {
  const byFindingId = new Map<
    string,
    { ruleId: RuleId; evidenceIds: Set<string>; confidences: number[] }
  >();

  for (const evaluation of evaluations.values()) {
    if (!evaluation.findingRuleId || !isRuleId(evaluation.findingRuleId)) {
      continue;
    }
    // Only emit findings when we have an evidence-backed conclusion.
    if (
      evaluation.state !== "SUPPORTED" &&
      evaluation.state !== "CONTRADICTED"
    ) {
      continue;
    }
    const policy = FINDING_POLICY[evaluation.findingRuleId];
    const existing = byFindingId.get(policy.findingId);
    if (!existing) {
      byFindingId.set(policy.findingId, {
        ruleId: evaluation.findingRuleId,
        evidenceIds: new Set(evaluation.supportingEvidenceIds),
        confidences: [evaluation.confidence],
      });
    } else {
      // Prefer the more severe rule when both medium/high map to same finding.
      const currentImpact = Math.abs(
        FINDING_POLICY[existing.ruleId].scoreImpact,
      );
      const nextImpact = Math.abs(policy.scoreImpact);
      if (nextImpact > currentImpact) {
        existing.ruleId = evaluation.findingRuleId;
      }
      for (const id of evaluation.supportingEvidenceIds) {
        existing.evidenceIds.add(id);
      }
      existing.confidences.push(evaluation.confidence);
    }
  }

  // Prefer concentration-high over medium when both present (same finding id).
  const concentrationRules = [...evaluations.values()]
    .map((e) => e.findingRuleId)
    .filter((r): r is RuleId => r === "concentration-high" || r === "concentration-medium");
  if (
    concentrationRules.includes("concentration-high") &&
    byFindingId.has("finding-concentration")
  ) {
    byFindingId.get("finding-concentration")!.ruleId = "concentration-high";
  }

  const findings: Finding[] = [];
  for (const [findingId, bundle] of byFindingId) {
    const policy = FINDING_POLICY[bundle.ruleId];
    const evidenceIds = [...bundle.evidenceIds];
    const sourceSystems = evidence
      .filter((e) => evidenceIds.includes(e.id))
      .map((e) => e.sourceSystem);
    const confidence = Math.round(
      bundle.confidences.reduce((s, c) => s + c, 0) / bundle.confidences.length,
    );
    findings.push({
      id: findingId,
      title: policy.title,
      description: policy.title,
      dimensionId: policy.dimensionId,
      dimension: dimensionName(policy.dimensionId),
      insightIds: [],
      evidenceIds,
      direction: policy.direction,
      materiality: policy.materiality,
      confidence,
      scoreImpact: policy.scoreImpact,
      summary: policy.title,
      extractedAt: "Just now",
      sourceSystem: sourceSystems[0] ?? "Diligence Questions",
    });
  }

  return findings;
}
