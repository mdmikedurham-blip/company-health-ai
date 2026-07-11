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

    // Structured financial spreadsheet/document metrics → Financial finding.
    // Only fires when enough typed financial facts were extracted (no inference).
    const financialPresent = [
      asNumber(facts.revenue),
      asNumber(facts.revenueGrowth),
      asRatio(facts.grossMargin),
      asNumber(facts.ebitda),
      asNumber(facts.operatingIncome),
      asNumber(facts.cashBalance),
      asNumber(facts.burnRateMonthly),
      asNumber(facts.cashRunwayMonths),
      asNumber(facts.debt),
    ].filter((v) => v !== null);
    if (financialPresent.length >= 2) {
      const parts: string[] = [];
      if (asNumber(facts.revenue) !== null) parts.push("revenue");
      if (asNumber(facts.cashBalance) !== null) parts.push("cash");
      if (asNumber(facts.cashRunwayMonths) !== null) {
        parts.push(`runway ${asNumber(facts.cashRunwayMonths)} mo`);
      }
      if (asRatio(facts.grossMargin) !== null) {
        parts.push(`gross margin ${formatPercent(asRatio(facts.grossMargin)!)}`);
      }
      if (asNumber(facts.ebitda) !== null || asNumber(facts.operatingIncome) !== null) {
        parts.push("operating earnings");
      }
      if (asNumber(facts.burnRateMonthly) !== null) parts.push("burn");
      if (asNumber(facts.debt) !== null) parts.push("debt");
      const period =
        typeof facts.revenuePeriod === "string"
          ? facts.revenuePeriod
          : typeof facts.cashBalancePeriod === "string"
            ? facts.cashBalancePeriod
            : null;
      const worksheet =
        typeof facts.revenueWorksheet === "string"
          ? facts.revenueWorksheet
          : typeof facts.cashBalanceWorksheet === "string"
            ? facts.cashBalanceWorksheet
            : null;
      const contextBits = [
        worksheet ? `sheet ${worksheet}` : null,
        period ? `period ${period}` : null,
      ].filter(Boolean);
      insights.push(
        makeInsight({
          id: `insight-financial-metrics-${item.id}`,
          statement: `Financial metrics extracted from source documents (${parts.join(", ")})${
            contextBits.length ? ` · ${contextBits.join(" · ")}` : ""
          }.`,
          dimensionId: "dim-financial",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "neutral",
          ruleId: "financial-metrics",
        }),
      );
    }

    // Structured board-minutes / consent facts → Governance finding.
    // Requires enough typed governance facts; document presence alone is not enough.
    const governanceSignals = [
      asBoolean(facts.boardApprovalsDocumented) === true,
      asBoolean(facts.directorElectionsDocumented) === true,
      asBoolean(facts.financingApprovalsDocumented) === true,
      asBoolean(facts.optionGrantsApproved) === true,
      asBoolean(facts.corporateActionsDocumented) === true,
      asBoolean(facts.writtenConsentDocumented) === true,
      asBoolean(facts.governanceCadenceDocumented) === true,
      typeof facts.boardMeetingDate === "string" &&
        facts.boardMeetingDate.trim().length > 0,
      asStringArray(facts.approvedItems).length > 0,
      asNumber(facts.optionGrantsMissingBoardApproval) !== null,
      asBoolean(facts.materialActionsMissingBoardApproval) !== null,
    ].filter(Boolean);
    if (governanceSignals.length >= 2) {
      const parts: string[] = [];
      if (asBoolean(facts.boardApprovalsDocumented)) parts.push("board approvals");
      if (asBoolean(facts.directorElectionsDocumented)) {
        parts.push("director elections");
      }
      if (asBoolean(facts.financingApprovalsDocumented)) {
        parts.push("financing approvals");
      }
      if (asBoolean(facts.optionGrantsApproved)) parts.push("option grants");
      if (asBoolean(facts.corporateActionsDocumented)) {
        parts.push("corporate actions");
      }
      if (asBoolean(facts.writtenConsentDocumented)) parts.push("written consent");
      if (asBoolean(facts.governanceCadenceDocumented)) parts.push("meeting cadence");
      if (typeof facts.boardMeetingDate === "string") {
        parts.push(`meeting ${facts.boardMeetingDate}`);
      }
      insights.push(
        makeInsight({
          id: `insight-governance-metrics-${item.id}`,
          statement: `Governance actions extracted from board documents (${parts.join(", ") || "structured facts"}).`,
          dimensionId: "dim-governance",
          evidenceIds: ids,
          confidence: conf,
          generatedAt: now,
          type: "neutral",
          ruleId: "governance-metrics",
        }),
      );
    }
  }

  return insights;
}
