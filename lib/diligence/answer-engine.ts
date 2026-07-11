/**
 * Diligence answer engine — Evidence → Question Answers.
 * Never fabricates: missing facts → INSUFFICIENT_EVIDENCE or UNKNOWN.
 */

import type { Evidence } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  DiligenceAnswerState,
  DiligenceQuestionAnswer,
  DiligenceQuestionDefinition,
  QuestionImportance,
  QuestionStageLevel,
} from "@/lib/domain/diligence-question";
import {
  CONCENTRATION_HIGH,
  CONCENTRATION_MEDIUM,
  LOW_ATTRITION_THRESHOLD,
  MFA_COVERAGE_THRESHOLD,
  NRR_RISK_THRESHOLD,
  RECURRING_REVENUE_POSITIVE,
  RUNWAY_HIGH_RISK,
  RUNWAY_MEDIUM_RISK,
  RUNWAY_POSITIVE,
  type RuleId,
  asBoolean,
  asNumber,
  asRatio,
  asStringArray,
  formatPercent,
} from "@/lib/intelligence/rules";
import { DILIGENCE_QUESTION_CATALOG } from "./catalog";

export type AnswerEvaluation = {
  state: DiligenceAnswerState;
  confidence: number;
  supportingEvidenceIds: string[];
  missingEvidence: string[];
  reasoning: string;
  /** When set, emit a finding via FINDING_POLICY for this answer. */
  findingRuleId?: RuleId;
};

const IMPORTANCE_WEIGHT: Record<QuestionImportance, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function stageLevelForQuestion(
  question: DiligenceQuestionDefinition,
  stage: CompanyLifecycleStage | null | undefined,
): QuestionStageLevel {
  if (!stage) return "optional";
  return question.stageLevels[stage] ?? "optional";
}

export function effectiveImportanceFor(
  question: DiligenceQuestionDefinition,
  goal: AssessmentGoalId | null | undefined,
): number {
  const base = IMPORTANCE_WEIGHT[question.importance];
  const mult =
    goal && question.goalImportance?.[goal] != null
      ? question.goalImportance[goal]!
      : 1;
  return Math.round(base * mult * 1000) / 1000;
}

function collectFacts(evidence: Evidence[]) {
  return evidence.map((e) => ({
    id: e.id,
    reliability: e.reliability,
    facts: e.extractedFacts,
    summary: `${e.title} ${e.contentSummary}`.toLowerCase(),
  }));
}

function bestEvidenceIds(
  items: { id: string; reliability: number }[],
  limit = 3,
): string[] {
  return [...items]
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, limit)
    .map((i) => i.id);
}

function meanReliability(items: { reliability: number }[]): number {
  if (items.length === 0) return 0;
  return Math.round(
    items.reduce((s, i) => s + i.reliability, 0) / items.length,
  );
}

function textHas(items: ReturnType<typeof collectFacts>, patterns: RegExp[]) {
  return items.filter((i) => patterns.some((p) => p.test(i.summary)));
}

function evaluateQuestion(
  question: DiligenceQuestionDefinition,
  evidence: Evidence[],
  stageLevel: QuestionStageLevel,
): AnswerEvaluation {
  if (stageLevel === "not_applicable") {
    return {
      state: "NOT_APPLICABLE",
      confidence: 100,
      supportingEvidenceIds: [],
      missingEvidence: [],
      reasoning: "Not applicable for the current lifecycle stage.",
    };
  }

  const items = collectFacts(evidence);
  if (items.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No evidence available to answer this question.",
    };
  }

  switch (question.id) {
    case "q-fin-fund-operations":
      return evalFundOperations(items, question);
    case "q-fin-runway-sufficient":
      return evalRunway(items, question);
    case "q-fin-revenue-growing":
      return evalRevenueGrowth(items, question);
    case "q-fin-recurring-healthy":
      return evalRecurring(items, question);
    case "q-fin-concentration-financial":
    case "q-cust-concentration":
      return evalConcentration(items, question);
    case "q-gov-board-approvals":
    case "q-gov-equity-issuances":
      return evalBoardApprovals(items, question);
    case "q-gov-cadence":
      return evalGovernanceCadence(items, question);
    case "q-gov-cap-table":
      return evalCapTable(items, question);
    case "q-legal-ip-assignments":
      return evalIpAssignments(items, question);
    case "q-legal-employment-agreements":
      return evalEmploymentAgreements(items, question);
    case "q-legal-customer-contracts":
      return evalCustomerContracts(items, question);
    case "q-cust-churn":
      return evalChurn(items, question);
    case "q-cust-nrr":
      return evalNrr(items, question);
    case "q-sec-policies":
      return evalSecurityPolicies(items, question);
    case "q-sec-incident-response":
      return evalIncidentResponse(items, question);
    case "q-sec-critical-controls":
      return evalSecurityControls(items, question);
    case "q-ops-kpi-monitoring":
      return evalKpiMonitoring(items, question);
    case "q-ops-process-ownership":
      return evalProcessOwnership(items, question);
    case "q-ops-financial-controls":
      return evalFinancialControls(items, question);
    case "q-people-key-person":
      return evalKeyPerson(items, question);
    case "q-people-attrition":
      return evalAttrition(items, question);
    case "q-people-org-clarity":
      return evalOrgClarity(items, question);
    default:
      return {
        state: "UNKNOWN",
        confidence: 0,
        supportingEvidenceIds: [],
        missingEvidence: question.requiredEvidenceTypes,
        reasoning:
          "No deterministic evaluator is registered for this question.",
      };
  }
}

function evalFundOperations(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const financialCounts = items.map((i) => {
    const present = [
      asNumber(i.facts.revenue),
      asNumber(i.facts.revenueGrowth),
      asRatio(i.facts.grossMargin),
      asNumber(i.facts.ebitda),
      asNumber(i.facts.operatingIncome),
      asNumber(i.facts.cashBalance),
      asNumber(i.facts.burnRateMonthly),
      asNumber(i.facts.cashRunwayMonths),
      asNumber(i.facts.debt),
    ].filter((v) => v !== null);
    return { item: i, count: present.length };
  });
  const rich = financialCounts.filter((r) => r.count >= 2);
  if (rich.length > 0) {
    const runway = asNumber(rich[0]!.item.facts.cashRunwayMonths);
    const ids = bestEvidenceIds(rich.map((r) => r.item));
    const conf = meanReliability(rich.map((r) => r.item));
    if (runway !== null && runway < RUNWAY_MEDIUM_RISK) {
      return {
        state: "CONTRADICTED",
        confidence: conf,
        supportingEvidenceIds: ids,
        missingEvidence: [],
        reasoning: `Financial metrics are present but runway (${runway} mo) is below the ${RUNWAY_MEDIUM_RISK}-month operating threshold.`,
        findingRuleId:
          runway < RUNWAY_HIGH_RISK ? "runway-high" : "runway-medium",
      };
    }
    return {
      state: "SUPPORTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning:
        "Structured financial metrics from source documents support operating funding assessment.",
      findingRuleId: "financial-metrics",
    };
  }

  // Fall back to runway-only signal when full metric pack is absent.
  const runwayOnly = evalRunway(items, question);
  if (runwayOnly.state !== "INSUFFICIENT_EVIDENCE") {
    return runwayOnly;
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "Insufficient financial metrics to assess operating funding capacity.",
  };
}

function evalRunway(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withRunway = items.filter((i) => asNumber(i.facts.cashRunwayMonths) != null);
  if (withRunway.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No cash runway fact found in evidence.",
    };
  }
  const runway = asNumber(withRunway[0]!.facts.cashRunwayMonths)!;
  const ids = bestEvidenceIds(withRunway);
  const conf = meanReliability(withRunway);
  if (runway < RUNWAY_HIGH_RISK) {
    return {
      state: "CONTRADICTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Cash runway is ${runway} months, below the ${RUNWAY_HIGH_RISK}-month high-risk threshold.`,
      findingRuleId: "runway-high",
    };
  }
  if (runway < RUNWAY_MEDIUM_RISK) {
    return {
      state: "CONTRADICTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Cash runway is ${runway} months, within the ${RUNWAY_HIGH_RISK}–${RUNWAY_MEDIUM_RISK} month medium-risk band.`,
      findingRuleId: "runway-medium",
    };
  }
  if (runway > RUNWAY_POSITIVE) {
    return {
      state: "SUPPORTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Cash runway is ${runway} months, above the ${RUNWAY_POSITIVE}-month positive threshold.`,
      findingRuleId: "runway-positive",
    };
  }
  return {
    state: "SUPPORTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Cash runway is ${runway} months, at or above the ${RUNWAY_MEDIUM_RISK}-month sufficiency threshold.`,
  };
}

function evalRevenueGrowth(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withGrowth = items.filter((i) => asNumber(i.facts.revenueGrowthRate) != null);
  if (withGrowth.length === 0) {
    // Do not invent growth from narrative alone.
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No revenueGrowthRate fact found in evidence.",
    };
  }
  const growth = asNumber(withGrowth[0]!.facts.revenueGrowthRate)!;
  const ids = bestEvidenceIds(withGrowth);
  const conf = meanReliability(withGrowth);
  if (growth > 0) {
    return {
      state: "SUPPORTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Revenue growth rate is ${formatPercent(growth)}.`,
    };
  }
  return {
    state: "CONTRADICTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Revenue growth rate is ${formatPercent(growth)} (not growing).`,
  };
}

function evalRecurring(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withRecurring = items.filter(
    (i) => asRatio(i.facts.recurringRevenueShare) != null,
  );
  if (withRecurring.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No recurringRevenueShare fact found in evidence.",
    };
  }
  const recurring = asRatio(withRecurring[0]!.facts.recurringRevenueShare)!;
  const ids = bestEvidenceIds(withRecurring);
  const conf = meanReliability(withRecurring);
  if (recurring > RECURRING_REVENUE_POSITIVE) {
    return {
      state: "SUPPORTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Recurring revenue is ${formatPercent(recurring)}, exceeding the ${formatPercent(RECURRING_REVENUE_POSITIVE)} quality threshold.`,
      findingRuleId: "recurring-revenue",
    };
  }
  return {
    state: "CONTRADICTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Recurring revenue is ${formatPercent(recurring)}, at or below the ${formatPercent(RECURRING_REVENUE_POSITIVE)} quality threshold.`,
  };
}

function evalConcentration(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withConc = items.filter(
    (i) => asRatio(i.facts.top3CustomerArrShare) != null,
  );
  if (withConc.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No top3CustomerArrShare fact found in evidence.",
    };
  }
  const top3 = asRatio(withConc[0]!.facts.top3CustomerArrShare)!;
  const ids = bestEvidenceIds(withConc);
  const conf = meanReliability(withConc);
  if (top3 > CONCENTRATION_HIGH) {
    return {
      state: "CONTRADICTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Top 3 customers represent ${formatPercent(top3)} of ARR, exceeding the ${formatPercent(CONCENTRATION_HIGH)} high-risk threshold.`,
      findingRuleId: "concentration-high",
    };
  }
  if (top3 >= CONCENTRATION_MEDIUM) {
    return {
      state: "CONTRADICTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Top 3 customers represent ${formatPercent(top3)} of ARR, within the medium-risk band.`,
      findingRuleId: "concentration-medium",
    };
  }
  return {
    state: "SUPPORTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Top 3 customers represent ${formatPercent(top3)} of ARR, below the ${formatPercent(CONCENTRATION_MEDIUM)} medium-risk band.`,
  };
}

function evalBoardApprovals(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const missingBoard = items.filter((i) => {
    const n = asNumber(i.facts.optionGrantsMissingBoardApproval);
    const flag = asBoolean(i.facts.materialActionsMissingBoardApproval);
    return (n !== null && n > 0) || flag === true;
  });
  const documented = items.filter(
    (i) => asBoolean(i.facts.boardApprovalsDocumented) === true,
  );
  const governanceSignals = items.filter((i) => {
    const votes = [
      asBoolean(i.facts.boardApprovalsDocumented),
      asBoolean(i.facts.directorElectionsDocumented),
      asBoolean(i.facts.officerAppointmentsDocumented),
      asBoolean(i.facts.equityIssuancesApproved),
      asNumber(i.facts.optionGrantsMissingBoardApproval),
    ].filter((v) => v !== null && v !== false);
    return votes.length >= 1;
  });

  if (missingBoard.length > 0) {
    return {
      state: "CONTRADICTED",
      confidence: meanReliability(missingBoard),
      supportingEvidenceIds: bestEvidenceIds(missingBoard),
      missingEvidence: [],
      reasoning:
        "Evidence shows option grants or material actions lacking documented board approval.",
      findingRuleId: "board-approval",
    };
  }
  if (documented.length > 0 || governanceSignals.length >= 1) {
    const source = documented.length > 0 ? documented : governanceSignals;
    return {
      state: "SUPPORTED",
      confidence: meanReliability(source),
      supportingEvidenceIds: bestEvidenceIds(source),
      missingEvidence: [],
      reasoning: "Governance actions from board documents support approval coverage.",
      findingRuleId: "governance-metrics",
    };
  }
  const mentions = textHas(items, [/board (minute|consent|approval)/i]);
  if (mentions.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No board-approval facts or board minutes evidence found.",
    };
  }
  // Mentions alone without structured facts → insufficient, never fabricate.
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: Math.min(40, meanReliability(mentions)),
    supportingEvidenceIds: bestEvidenceIds(mentions),
    missingEvidence: ["board_approvals"],
    reasoning:
      "Board-related documents are present but structured approval facts are missing.",
  };
}

function evalGovernanceCadence(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const cadence = items.filter(
    (i) =>
      asBoolean(i.facts.governanceCadenceAppropriate) === true ||
      asNumber(i.facts.boardMeetingsLast12Months) != null,
  );
  if (cadence.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No governance cadence facts found.",
    };
  }
  const meetings = asNumber(cadence[0]!.facts.boardMeetingsLast12Months);
  if (meetings !== null && meetings < 2) {
    return {
      state: "CONTRADICTED",
      confidence: meanReliability(cadence),
      supportingEvidenceIds: bestEvidenceIds(cadence),
      missingEvidence: [],
      reasoning: `Only ${meetings} board meeting(s) in the last 12 months.`,
    };
  }
  return {
    state: "SUPPORTED",
    confidence: meanReliability(cadence),
    supportingEvidenceIds: bestEvidenceIds(cadence),
    missingEvidence: [],
    reasoning: "Governance cadence evidence supports an appropriate board rhythm.",
  };
}

function evalCapTable(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const caps = items.filter(
    (i) =>
      asBoolean(i.facts.capTableCurrent) === true ||
      asBoolean(i.facts.capTablePresent) === true,
  );
  const mentions = textHas(items, [/cap\s*table/i]);
  if (caps.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(caps),
      supportingEvidenceIds: bestEvidenceIds(caps),
      missingEvidence: [],
      reasoning: "Cap table evidence is present and marked current/reconciled.",
    };
  }
  if (mentions.length > 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: Math.min(40, meanReliability(mentions)),
      supportingEvidenceIds: bestEvidenceIds(mentions),
      missingEvidence: ["cap_table_reconciliation"],
      reasoning:
        "Cap table documents exist but reconciliation/current flags are missing.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No cap table evidence found.",
  };
}

function evalIpAssignments(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withGap = items.filter((i) => {
    const n = asNumber(i.facts.agreementsMissingIpAssignment);
    return n !== null && n > 0;
  });
  const complete = items.filter(
    (i) => asBoolean(i.facts.ipAssignmentsComplete) === true,
  );
  if (withGap.length > 0) {
    return {
      state: "CONTRADICTED",
      confidence: meanReliability(withGap),
      supportingEvidenceIds: bestEvidenceIds(withGap),
      missingEvidence: [],
      reasoning: "Agreements are missing signed intellectual-property assignment clauses.",
      findingRuleId: "ip-gap",
    };
  }
  if (complete.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(complete),
      supportingEvidenceIds: bestEvidenceIds(complete),
      missingEvidence: [],
      reasoning: "Evidence indicates IP assignments are complete.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No IP assignment facts found in evidence.",
  };
}

function evalEmploymentAgreements(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const present = items.filter(
    (i) =>
      asBoolean(i.facts.employmentAgreementsPresent) === true ||
      (asNumber(i.facts.totalContractorAgreements) != null &&
        asNumber(i.facts.totalContractorAgreements)! > 0),
  );
  if (present.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(present),
      supportingEvidenceIds: bestEvidenceIds(present),
      missingEvidence: [],
      reasoning: "Employment or contractor agreement evidence is present.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No employment agreement facts found.",
  };
}

function evalCustomerContracts(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const contracts = items.filter(
    (i) =>
      asBoolean(i.facts.customerContractsOnFile) === true ||
      asNumber(i.facts.materialCustomerContractsCount) != null,
  );
  const mentions = textHas(items, [/\bmsa\b/, /customer contract/, /order form/]);
  if (contracts.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(contracts),
      supportingEvidenceIds: bestEvidenceIds(contracts),
      missingEvidence: [],
      reasoning: "Material customer contract evidence is on file.",
    };
  }
  if (mentions.length > 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: Math.min(40, meanReliability(mentions)),
      supportingEvidenceIds: bestEvidenceIds(mentions),
      missingEvidence: ["customer_contracts_inventory"],
      reasoning:
        "Contract-related documents found without structured on-file confirmation.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No customer contract evidence found.",
  };
}

function evalChurn(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withChurn = items.filter(
    (i) =>
      asRatio(i.facts.logoChurnRate) != null ||
      asRatio(i.facts.revenueChurnRate) != null,
  );
  if (withChurn.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No churn rate facts found.",
    };
  }
  return {
    state: "SUPPORTED",
    confidence: meanReliability(withChurn),
    supportingEvidenceIds: bestEvidenceIds(withChurn),
    missingEvidence: [],
    reasoning: "Churn metrics are present and measurable from evidence.",
  };
}

function evalNrr(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withNrr = items.filter((i) => asRatio(i.facts.netRevenueRetention) != null);
  if (withNrr.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No netRevenueRetention fact found.",
    };
  }
  const nrr = asRatio(withNrr[0]!.facts.netRevenueRetention)!;
  const ids = bestEvidenceIds(withNrr);
  const conf = meanReliability(withNrr);
  if (nrr < NRR_RISK_THRESHOLD) {
    return {
      state: "CONTRADICTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Net revenue retention is ${formatPercent(nrr)}, below the ${formatPercent(NRR_RISK_THRESHOLD)} risk threshold.`,
      findingRuleId: "nrr",
    };
  }
  return {
    state: "SUPPORTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Net revenue retention is ${formatPercent(nrr)}, at or above the ${formatPercent(NRR_RISK_THRESHOLD)} threshold.`,
  };
}

function evalSecurityPolicies(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const policies = items.filter(
    (i) => asBoolean(i.facts.securityPoliciesDocumented) === true,
  );
  if (policies.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(policies),
      supportingEvidenceIds: bestEvidenceIds(policies),
      missingEvidence: [],
      reasoning: "Documented security policies are evidenced.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No securityPoliciesDocumented fact found.",
  };
}

function evalIncidentResponse(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const ir = items.filter(
    (i) => asBoolean(i.facts.incidentResponsePlanPresent) === true,
  );
  if (ir.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(ir),
      supportingEvidenceIds: bestEvidenceIds(ir),
      missingEvidence: [],
      reasoning: "Incident response plan evidence is present.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No incidentResponsePlanPresent fact found.",
  };
}

function evalSecurityControls(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const controlHits = items.filter((i) => {
    const open = asNumber(i.facts.openCriticalControls);
    const mfa = asRatio(i.facts.mfaCoverage);
    return open !== null || mfa !== null;
  });
  if (controlHits.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No openCriticalControls or mfaCoverage facts found.",
    };
  }
  for (const item of controlHits) {
    const open = asNumber(item.facts.openCriticalControls);
    if (open !== null && open > 0) {
      return {
        state: "CONTRADICTED",
        confidence: Math.round(item.reliability),
        supportingEvidenceIds: [item.id],
        missingEvidence: [],
        reasoning: `${open} critical security control(s) remain open.`,
        findingRuleId: "critical-controls",
      };
    }
    const mfa = asRatio(item.facts.mfaCoverage);
    if (mfa !== null && mfa < MFA_COVERAGE_THRESHOLD) {
      return {
        state: "CONTRADICTED",
        confidence: Math.round(item.reliability),
        supportingEvidenceIds: [item.id],
        missingEvidence: [],
        reasoning: `MFA coverage is ${formatPercent(mfa)}, below ${formatPercent(MFA_COVERAGE_THRESHOLD)}.`,
        findingRuleId: "mfa",
      };
    }
  }
  return {
    state: "SUPPORTED",
    confidence: meanReliability(controlHits),
    supportingEvidenceIds: bestEvidenceIds(controlHits),
    missingEvidence: [],
    reasoning: "Critical controls and MFA coverage meet policy thresholds.",
  };
}

function evalKpiMonitoring(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const kpis = items.filter(
    (i) =>
      asBoolean(i.facts.kpiMonitoringPresent) === true ||
      asBoolean(i.facts.operatingMetricsTracked) === true,
  );
  if (kpis.length > 0) {
  return {
    state: "SUPPORTED",
    confidence: meanReliability(kpis),
    supportingEvidenceIds: bestEvidenceIds(kpis),
    missingEvidence: [],
    reasoning: "KPI / operating metrics monitoring is evidenced.",
  };
}
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No KPI monitoring facts found.",
  };
}

function evalProcessOwnership(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const owned = items.filter(
    (i) => asBoolean(i.facts.criticalProcessesOwned) === true,
  );
  if (owned.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(owned),
      supportingEvidenceIds: bestEvidenceIds(owned),
      missingEvidence: [],
      reasoning: "Critical process ownership is evidenced.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No criticalProcessesOwned fact found.",
  };
}

function evalFinancialControls(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const controls = items.filter(
    (i) => asBoolean(i.facts.financialControlsPresent) === true,
  );
  if (controls.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(controls),
      supportingEvidenceIds: bestEvidenceIds(controls),
      missingEvidence: [],
      reasoning: "Basic financial controls are evidenced.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No financialControlsPresent fact found.",
  };
}

function evalKeyPerson(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withRisk = items.filter((i) => {
    const list = asStringArray(i.facts.singleOwnerCriticalFunctions);
    return list.length > 0;
  });
  const identified = items.filter(
    (i) => asBoolean(i.facts.keyPersonRisksIdentified) === true,
  );
  if (withRisk.length > 0) {
    return {
      state: "CONTRADICTED",
      confidence: meanReliability(withRisk),
      supportingEvidenceIds: bestEvidenceIds(withRisk),
      missingEvidence: [],
      reasoning: "Single-owner critical functions are present (key-person risk).",
      findingRuleId: "key-person",
    };
  }
  if (identified.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(identified),
      supportingEvidenceIds: bestEvidenceIds(identified),
      missingEvidence: [],
      reasoning: "Key-person risks have been identified and documented.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No key-person risk facts found.",
  };
}

function evalAttrition(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const withAttr = items.filter(
    (i) => asRatio(i.facts.voluntaryAttritionRate) != null,
  );
  if (withAttr.length === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      confidence: 0,
      supportingEvidenceIds: [],
      missingEvidence: question.requiredEvidenceTypes,
      reasoning: "No voluntaryAttritionRate fact found.",
    };
  }
  const rate = asRatio(withAttr[0]!.facts.voluntaryAttritionRate)!;
  const ids = bestEvidenceIds(withAttr);
  const conf = meanReliability(withAttr);
  if (rate <= LOW_ATTRITION_THRESHOLD) {
    return {
      state: "SUPPORTED",
      confidence: conf,
      supportingEvidenceIds: ids,
      missingEvidence: [],
      reasoning: `Voluntary attrition is ${formatPercent(rate)}, at or below ${formatPercent(LOW_ATTRITION_THRESHOLD)}.`,
      findingRuleId: "low-attrition",
    };
  }
  return {
    state: "CONTRADICTED",
    confidence: conf,
    supportingEvidenceIds: ids,
    missingEvidence: [],
    reasoning: `Voluntary attrition is ${formatPercent(rate)}, above ${formatPercent(LOW_ATTRITION_THRESHOLD)}.`,
  };
}

function evalOrgClarity(
  items: ReturnType<typeof collectFacts>,
  question: DiligenceQuestionDefinition,
): AnswerEvaluation {
  const org = items.filter(
    (i) =>
      asBoolean(i.facts.orgChartPresent) === true ||
      asBoolean(i.facts.organizationalOwnershipClear) === true,
  );
  if (org.length > 0) {
    return {
      state: "SUPPORTED",
      confidence: meanReliability(org),
      supportingEvidenceIds: bestEvidenceIds(org),
      missingEvidence: [],
      reasoning: "Organizational ownership / org chart evidence is present.",
    };
  }
  return {
    state: "INSUFFICIENT_EVIDENCE",
    confidence: 0,
    supportingEvidenceIds: [],
    missingEvidence: question.requiredEvidenceTypes,
    reasoning: "No org chart / ownership clarity facts found.",
  };
}

/**
 * Answer the full catalog for a company. Deterministic for same inputs.
 */
export function answerDiligenceQuestions(input: {
  companyId: string;
  evidence: Evidence[];
  stage?: CompanyLifecycleStage | null;
  assessmentGoal?: AssessmentGoalId | null;
  snapshotId?: string | null;
  asOf?: string;
  catalog?: DiligenceQuestionDefinition[];
}): {
  answers: DiligenceQuestionAnswer[];
  evaluations: Map<string, AnswerEvaluation>;
} {
  const catalog = input.catalog ?? DILIGENCE_QUESTION_CATALOG;
  const asOf = input.asOf ?? new Date().toISOString();
  const evaluations = new Map<string, AnswerEvaluation>();
  const answers: DiligenceQuestionAnswer[] = [];

  for (const question of catalog) {
    const stageLevel = stageLevelForQuestion(question, input.stage);
    const evaluation = evaluateQuestion(question, input.evidence, stageLevel);
    evaluations.set(question.id, evaluation);
    answers.push({
      questionId: question.id,
      companyId: input.companyId,
      state: evaluation.state,
      confidence: evaluation.confidence,
      supportingEvidenceIds: evaluation.supportingEvidenceIds,
      missingEvidence: evaluation.missingEvidence,
      reasoning: evaluation.reasoning,
      lastUpdated: asOf,
      snapshotId: input.snapshotId ?? null,
      stageLevel,
      effectiveImportance: effectiveImportanceFor(
        question,
        input.assessmentGoal,
      ),
    });
  }

  return { answers, evaluations };
}

/**
 * Reorder catalog ids by effective importance for a goal — does not change answers.
 */
export function prioritizeQuestionIds(
  answers: DiligenceQuestionAnswer[],
  goal?: AssessmentGoalId | null,
  catalog: DiligenceQuestionDefinition[] = DILIGENCE_QUESTION_CATALOG,
): string[] {
  return [...catalog]
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        importance:
          answer?.effectiveImportance ??
          effectiveImportanceFor(q, goal),
      };
    })
    .sort((a, b) => b.importance - a.importance)
    .map((q) => q.id);
}
