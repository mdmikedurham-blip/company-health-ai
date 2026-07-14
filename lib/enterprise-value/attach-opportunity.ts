/**
 * Overlay transparent EV Opportunity onto a Value Navigator view.
 * Kept outside value-navigator to avoid circular imports with the EV engine.
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { ValueNavigatorView } from "@/lib/domain/value-navigator";
import { buildNavigatorFromEvidence } from "@/lib/value-navigator/from-evidence";
import { mid, moneyRange } from "@/lib/value-navigator/money";
import { estimateTransparentEnterpriseValue } from "./engine";

export function attachEnterpriseValueOpportunity(
  view: ValueNavigatorView,
  input: {
    companyId: string;
    snapshotId: string | null;
    assessmentGoal: AssessmentGoalId;
    evidence: Evidence[];
  },
): ValueNavigatorView {
  const enterpriseValue = estimateTransparentEnterpriseValue(input);
  if (!enterpriseValue.available) {
    return {
      ...view,
      enterpriseValue,
      navigator: {
        ...view.navigator,
        valuationConfidence: 0,
        missingInputs:
          enterpriseValue.missingInputs.length > 0
            ? enterpriseValue.missingInputs
            : view.navigator.missingInputs,
        assumptions:
          enterpriseValue.assumptions.length > 0
            ? enterpriseValue.assumptions
            : view.navigator.assumptions,
      },
    };
  }

  const current =
    enterpriseValue.currentEnterpriseValueRange ?? moneyRange(0, 0);
  const potential =
    enterpriseValue.potentialEnterpriseValueRange ?? moneyRange(0, 0);
  const opportunity =
    enterpriseValue.enterpriseValueOpportunityRange ?? moneyRange(0, 0);
  const method =
    enterpriseValue.valuationMethod === "unavailable"
      ? view.navigator.valuationMethod
      : enterpriseValue.valuationMethod;

  const missingPriority = enterpriseValue.missingEvidencePriorities[0] ?? null;
  const evidenceRequest =
    view.navigator.evidenceRequest ??
    (missingPriority
      ? {
          label: missingPriority.label,
          why: missingPriority.why,
          expectedValueImpact: null,
          expectedConfidenceIncrease: missingPriority.estimatedConfidenceGain,
          estimatedTime: "15–30 minutes",
        }
      : null);

  return {
    ...view,
    enterpriseValue,
    navigator: {
      ...view.navigator,
      valuationMethod: method,
      currentEstimatedEnterpriseValueRange: current,
      potentialEnterpriseValueRange: potential,
      enterpriseValueOpportunity: opportunity,
      valueGap: opportunity,
      valuationConfidence: enterpriseValue.valuationConfidence,
      assumptions: enterpriseValue.assumptions,
      dataCompleteness: enterpriseValue.dataCompleteness,
      missingInputs: enterpriseValue.missingInputs,
      generatedAt: enterpriseValue.generatedAt,
      evidenceRequest,
    },
    timeline: view.timeline.map((row) =>
      row.label === "Current"
        ? {
            ...row,
            enterpriseValueMid: mid(current),
            confidence: enterpriseValue.valuationConfidence,
            coverage: enterpriseValue.dataCompleteness,
          }
        : row,
    ),
    provenance: {
      ...view.provenance,
      generatedAt: enterpriseValue.generatedAt,
      valuationMethod: method,
    },
  };
}

/** Preferred dashboard/API entry — navigator + transparent Opportunity. */
export function buildOpportunityNavigatorFromEvidence(input: {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  evidence: Evidence[];
  healthScore?: number | null;
  coverage?: number | null;
}): ValueNavigatorView {
  const base = buildNavigatorFromEvidence(input);
  return attachEnterpriseValueOpportunity(base, {
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    assessmentGoal: input.assessmentGoal,
    evidence: input.evidence,
  });
}
