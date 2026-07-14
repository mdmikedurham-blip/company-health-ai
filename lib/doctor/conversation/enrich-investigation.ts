/**
 * Enrich Doctor investigations with Phase 11 value + fact linkage.
 */

import type { CompanyHealthSnapshot } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type {
  DoctorInvestigation,
  DoctorNextAction,
} from "@/lib/domain/doctor-conversation";
import type {
  DoctorAlternativePath,
  DoctorWhatChanged,
  EnterpriseValueEstimate,
} from "@/lib/domain/enterprise-value";
import { collectStructuredFinancialFacts } from "@/lib/doctor/financial-diagnosis";
import {
  buildNavigatorFromEvidence,
  formatUsdRange,
} from "@/lib/value-navigator";
import type { ValueDriverKey } from "@/lib/domain/value-navigator";
const INVESTIGATION_VALUE_DRIVER: Partial<
  Record<string, ValueDriverKey>
> = {
  "inv-customer-concentration": "customer-concentration",
  "inv-runway-shortening": "cash-runway",
  "inv-cash-declining": "cash-runway",
  "inv-revenue-slowing": "revenue-growth",
  "inv-governance-gaps": "governance",
  "inv-security-readiness": "soc2",
  "inv-product-execution": "product-execution",
  "inv-hiring-too-quickly": "leadership",
};

export function enrichInvestigation(input: {
  investigation: DoctorInvestigation;
  snapshot: CompanyHealthSnapshot;
  goal: AssessmentGoalId;
  observation: string;
}): DoctorInvestigation {
  const inv = { ...input.investigation };
  const facts = collectStructuredFinancialFacts(input.snapshot);
  const view = buildNavigatorFromEvidence({
    companyId: input.snapshot.company.id,
    snapshotId: input.snapshot.assessmentSnapshotId ?? null,
    assessmentGoal: input.goal,
    evidence: input.snapshot.evidence,
  });
  const driverKey = INVESTIGATION_VALUE_DRIVER[inv.templateId];
  const driver = driverKey
    ? view.navigator.drivers.find((d) => d.key === driverKey)
    : view.navigator.drivers[0];

  const primary = inv.hypotheses[0] ?? null;
  const alternatives = inv.hypotheses.slice(1);

  // Low-confidence: keep hypotheses as possibilities — callers label in UI.
  inv.observation = input.observation;
  inv.primaryHypothesis = primary
    ? inv.confidence < 40
      ? `Possible issue to investigate: ${primary}`
      : primary
    : null;
  inv.alternativeHypotheses = alternatives;
  inv.supportingFactKeys = facts.map((f) => f.key).slice(0, 12);
  inv.supportingEvidenceIds = [
    ...new Set([
      ...facts.map((f) => f.evidenceId),
      ...(driver?.supportingEvidenceIds ?? []),
    ]),
  ].slice(0, 12);
  inv.materiality = driver
    ? Math.min(100, Math.round(40 + (driver.confidence / 100) * 40))
    : inv.confidence >= 40
      ? 50
      : 30;
  inv.expectedBusinessImpact =
    driver?.businessRationale ??
    "Resolving this uncertainty may change enterprise value confidence and next actions.";
  inv.estimatedValueImpact = driver?.estimatedValueImpact ?? null;
  inv.estimatedConfidenceGain = driver
    ? Math.round(10 + (100 - driver.confidence) * 0.12)
    : 15;

  if (inv.evidenceRequest) {
    inv.evidenceRequest = {
      ...inv.evidenceRequest,
      estimatedValueImpact: driver?.estimatedValueImpact ?? null,
      expectedValueImpactLabel: driver
        ? formatUsdRange(driver.estimatedValueImpact)
        : inv.evidenceRequest.expectedValueImpactLabel,
      expectedConfidenceIncrease:
        inv.estimatedConfidenceGain ??
        inv.evidenceRequest.expectedConfidenceIncrease,
      questionsItMayAnswer: [inv.businessQuestion],
      connectorOrUploadType: inv.evidenceRequest.connectAlternative
        ? "connector"
        : "upload",
      whyRanksAboveAlternatives:
        "This action most reduces valuation uncertainty for the active investigation.",
    };
  }

  if (inv.recommendation) {
    inv.recommendation = enrichPrimaryAction({
      action: inv.recommendation,
      investigation: inv,
    });
  }

  return inv;
}

export function enrichPrimaryAction(input: {
  action: DoctorNextAction;
  investigation: DoctorInvestigation;
}): DoctorNextAction {
  const inv = input.investigation;
  const evidenceRequired = [
    ...(inv.evidenceRequest
      ? [inv.evidenceRequest.label, ...inv.evidenceRequest.evidenceTypes]
      : []),
    ...inv.blockingUnknowns,
    ...inv.requiredEvidence.map((r) => r.label),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  const valueImpact = inv.estimatedValueImpact ?? null;
  const confidenceGain = inv.estimatedConfidenceGain ?? undefined;
  const effort =
    inv.evidenceRequest?.estimatedEffort ??
    input.action.estimatedEffort ??
    "medium";

  return {
    ...input.action,
    whyItMatters: inv.expectedBusinessImpact ?? input.action.rationale,
    expectedInsight:
      inv.evidenceRequest?.expectedInsight ?? input.action.description,
    estimatedEffort: effort,
    estimatedConfidenceIncrease: confidenceGain,
    estimatedValueImpact: valueImpact,
    expectedEnterpriseValueIncrease: valueImpact,
    evidenceRequired: evidenceRequired.slice(0, 6),
    questionsItMayAnswer: [inv.businessQuestion],
    connectorOrUploadType: inv.evidenceRequest?.connectAlternative
      ? "connector"
      : "upload",
    whyRanksAboveAlternatives:
      "Highest expected value impact × confidence gain for the current investigation.",
  };
}

export function buildAlternativePaths(input: {
  snapshot: CompanyHealthSnapshot;
  goal: AssessmentGoalId;
  activeTemplateId: string | null;
}): DoctorAlternativePath[] {
  const view = buildNavigatorFromEvidence({
    companyId: input.snapshot.company.id,
    snapshotId: input.snapshot.assessmentSnapshotId ?? null,
    assessmentGoal: input.goal,
    evidence: input.snapshot.evidence,
  });
  const activeDriver = input.activeTemplateId
    ? INVESTIGATION_VALUE_DRIVER[input.activeTemplateId]
    : null;

  return view.navigator.drivers
    .filter((d) => d.key !== activeDriver)
    .slice(0, 3)
    .map((d) => ({
      id: `alt-${d.key}`,
      title: d.title,
      whyLowerPriority: `Lower expected value than the primary investigation (${formatUsdRange(d.estimatedValueImpact)} vs primary).`,
      estimatedValueImpact: d.estimatedValueImpact,
    }));
}

export function buildWhatChanged(input: {
  learned: { text: string }[];
  investigation: DoctorInvestigation | null;
  confidenceBefore: number | null;
  confidenceAfter: number;
  enterpriseValue: EnterpriseValueEstimate | null;
  priorEnterpriseValueMid: number | null;
}): DoctorWhatChanged | null {
  if (input.learned.length === 0 && input.confidenceBefore == null) {
    return null;
  }
  const afterMid =
    input.enterpriseValue?.currentEnterpriseValueRange != null
      ? (input.enterpriseValue.currentEnterpriseValueRange.low +
          input.enterpriseValue.currentEnterpriseValueRange.high) /
        2
      : null;
  const beforeMid = input.priorEnterpriseValueMid;
  let valuationDeltaNote =
    "Valuation range unchanged — new evidence mainly improved confidence, not intrinsic operating inputs.";
  if (beforeMid != null && afterMid != null && Math.abs(afterMid - beforeMid) > 1) {
    const dir = afterMid > beforeMid ? "widened upward" : "moved lower";
    valuationDeltaNote = `Preliminary enterprise value mid ${dir} after re-analysis (still a range, not a point estimate).`;
  }

  return {
    newFactsLearned: input.learned.map((l) => l.text).slice(0, 5),
    hypothesesConfirmed:
      input.investigation && input.investigation.confidence >= 55
        ? [input.investigation.primaryHypothesis ?? input.investigation.title]
        : [],
    hypothesesRejected: [],
    confidenceBefore: input.confidenceBefore,
    confidenceAfter: input.confidenceAfter,
    confidenceDelta:
      input.confidenceBefore != null
        ? input.confidenceAfter - input.confidenceBefore
        : 0,
    valuationBeforeMid: beforeMid,
    valuationAfterMid: afterMid,
    valuationDeltaNote,
    nextInvestigationTitle: input.investigation?.title ?? null,
  };
}
