/**
 * Evidence Analyzer — Evidence → Insights.
 *
 * Reads extractedFacts with deterministic rules. No external AI calls.
 * Each insight carries a stable ruleId for downstream finding/risk engines.
 */

import type { Evidence, Insight, InsightType } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";
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
} from "./rules";

function makeInsight(params: {
  id: string;
  statement: string;
  dimensionId: string;
  evidenceIds: string[];
  confidence: number;
  generatedAt: string;
  type: InsightType;
  ruleId: RuleId;
}): Insight {
  return {
    id: params.id,
    statement: params.statement,
    dimensionId: params.dimensionId,
    dimension: dimensionName(params.dimensionId),
    evidenceIds: params.evidenceIds,
    confidence: params.confidence,
    generatedAt: params.generatedAt,
    ruleId: params.ruleId,
    findingIds: [],
    type: params.type,
  };
}

export function analyzeEvidence(evidence: Evidence[]): Insight[] {
  const insights: Insight[] = [];
  const now = "Just now";

  for (const item of evidence) {
    const facts = item.extractedFacts;
    const conf = Math.round(item.reliability);
    const ids = [item.id];

    const top3 = asRatio(facts.top3CustomerArrShare);
    if (top3 !== null) {
      if (top3 > CONCENTRATION_HIGH) {
        insights.push(
          makeInsight({
            id: `insight-concentration-${item.id}`,
            statement: `Top 3 customers represent ${formatPercent(top3)} of ARR, exceeding the ${formatPercent(CONCENTRATION_HIGH)} high-risk threshold.`,
            dimensionId: "dim-customer",
            evidenceIds: ids,
            confidence: conf,
            generatedAt: now,
            type: "alert",
            ruleId: "concentration-high",
          }),
        );
      } else if (top3 >= CONCENTRATION_MEDIUM) {
        insights.push(
          makeInsight({
            id: `insight-concentration-${item.id}`,
            statement: `Top 3 customers represent ${formatPercent(top3)} of ARR, within the ${formatPercent(CONCENTRATION_MEDIUM)}–${formatPercent(CONCENTRATION_HIGH)} medium-risk band.`,
            dimensionId: "dim-customer",
            evidenceIds: ids,
            confidence: conf,
            generatedAt: now,
            type: "alert",
            ruleId: "concentration-medium",
          }),
        );
      }
    }

    const missingIp = asNumber(facts.agreementsMissingIpAssignment);
    const totalAgreements = asNumber(facts.totalContractorAgreements);
    if (missingIp !== null && missingIp > 0) {
      const totalLabel =
        totalAgreements !== null ? ` of ${totalAgreements} active agreements` : "";
      insights.push(
        makeInsight({
          id: `insight-ip-gap-${item.id}`,
          statement: `${missingIp} contractor or employee agreement${missingIp === 1 ? "" : "s"}${totalLabel} lack signed intellectual-property assignment clauses.`,
          dimensionId: "dim-legal",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "ip-gap",
        }),
      );
    }

    const missingBoard = asNumber(facts.optionGrantsMissingBoardApproval);
    const materialActionsMissing = asBoolean(facts.materialActionsMissingBoardApproval);
    if ((missingBoard !== null && missingBoard > 0) || materialActionsMissing === true) {
      const grantPart =
        missingBoard !== null && missingBoard > 0
          ? `${missingBoard} option grant${missingBoard === 1 ? "" : "s"} lack documented board approval`
          : "Material actions lack documented board approval";
      insights.push(
        makeInsight({
          id: `insight-board-approval-${item.id}`,
          statement: `${grantPart}.`,
          dimensionId: "dim-governance",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "board-approval",
        }),
      );
    }

    const runway = asNumber(facts.cashRunwayMonths);
    if (runway !== null) {
      if (runway < RUNWAY_HIGH_RISK) {
        insights.push(
          makeInsight({
            id: `insight-runway-${item.id}`,
            statement: `Cash runway is ${runway} months, below the ${RUNWAY_HIGH_RISK}-month high-risk threshold.`,
            dimensionId: "dim-financial",
            evidenceIds: ids,
            confidence: conf,
            generatedAt: now,
            type: "alert",
            ruleId: "runway-high",
          }),
        );
      } else if (runway < RUNWAY_MEDIUM_RISK) {
        insights.push(
          makeInsight({
            id: `insight-runway-${item.id}`,
            statement: `Cash runway is ${runway} months, within the ${RUNWAY_HIGH_RISK}–${RUNWAY_MEDIUM_RISK} month medium-risk band.`,
            dimensionId: "dim-financial",
            evidenceIds: ids,
            confidence: conf,
            generatedAt: now,
            type: "alert",
            ruleId: "runway-medium",
          }),
        );
      } else if (runway > RUNWAY_POSITIVE) {
        insights.push(
          makeInsight({
            id: `insight-runway-${item.id}`,
            statement: `Cash runway is ${runway} months, above the ${RUNWAY_POSITIVE}-month positive threshold.`,
            dimensionId: "dim-financial",
            evidenceIds: ids,
            confidence: conf,
            generatedAt: now,
            type: "positive",
            ruleId: "runway-positive",
          }),
        );
      }
    }

    const recurring = asRatio(facts.recurringRevenueShare);
    if (recurring !== null && recurring > RECURRING_REVENUE_POSITIVE) {
      insights.push(
        makeInsight({
          id: `insight-recurring-${item.id}`,
          statement: `Recurring revenue is ${formatPercent(recurring)}, exceeding the ${formatPercent(RECURRING_REVENUE_POSITIVE)} quality threshold.`,
          dimensionId: "dim-revenue-quality",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "positive",
          ruleId: "recurring-revenue",
        }),
      );
    }

    const nrr = asRatio(facts.netRevenueRetention);
    if (nrr !== null && nrr < NRR_RISK_THRESHOLD) {
      insights.push(
        makeInsight({
          id: `insight-nrr-${item.id}`,
          statement: `Net revenue retention is ${formatPercent(nrr)}, below the ${formatPercent(NRR_RISK_THRESHOLD)} risk threshold.`,
          dimensionId: "dim-revenue-quality",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "nrr",
        }),
      );
    }

    const openCritical = asNumber(facts.openCriticalControls);
    if (openCritical !== null && openCritical > 0) {
      insights.push(
        makeInsight({
          id: `insight-critical-controls-${item.id}`,
          statement: `${openCritical} critical security control${openCritical === 1 ? "" : "s"} remain open.`,
          dimensionId: "dim-security",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "critical-controls",
        }),
      );
    }

    const mfa = asRatio(facts.mfaCoverage);
    if (mfa !== null && mfa < MFA_COVERAGE_THRESHOLD) {
      insights.push(
        makeInsight({
          id: `insight-mfa-${item.id}`,
          statement: `Multi-factor authentication coverage is ${formatPercent(mfa)}, below the ${formatPercent(MFA_COVERAGE_THRESHOLD)} threshold.`,
          dimensionId: "dim-security",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "mfa",
        }),
      );
    }

    const attrition = asRatio(facts.voluntaryAttritionRate);
    if (attrition !== null && attrition <= LOW_ATTRITION_THRESHOLD) {
      insights.push(
        makeInsight({
          id: `insight-attrition-${item.id}`,
          statement: `Voluntary attrition is ${formatPercent(attrition)}, indicating strong people health.`,
          dimensionId: "dim-people",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "positive",
          ruleId: "low-attrition",
        }),
      );
    }

    const singleOwnerFunctions = asStringArray(facts.singleOwnerCriticalFunctions);
    if (singleOwnerFunctions.length > 0) {
      insights.push(
        makeInsight({
          id: `insight-key-person-${item.id}`,
          statement: `Critical function${singleOwnerFunctions.length === 1 ? "" : "s"} with a single owner: ${singleOwnerFunctions.join(", ")}.`,
          dimensionId: "dim-people",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "alert",
          ruleId: "key-person",
        }),
      );
    }
  }

  return insights;
}
