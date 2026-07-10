/**
 * Risk Engine — Findings → Risks.
 * Severity and impact normalization come from rules.ts.
 */

import type { Evidence, Finding, Risk } from "@/lib/domain";
import { formatEvidenceLabel } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";
import { deriveRiskSeverity, normalizeRiskImpact } from "./rules";

function likelihoodFromConfidence(confidence: number): number {
  return Math.round(confidence) / 100;
}

const RISK_TEMPLATES: Record<
  string,
  {
    id: string;
    title: string;
    whyItMatters: string;
    recommendation: string;
    recommendationId: string;
  }
> = {
  "finding-concentration": {
    id: "risk-concentration",
    title: "Customer concentration",
    whyItMatters:
      "Investors and boards flag elevated concentration. A single churn event could reduce runway materially and trigger covenant reviews.",
    recommendation:
      "Launch mid-market expansion to reduce top-3 concentration below the policy target.",
    recommendationId: "rec-diversify-customers",
  },
  "finding-ip-gap": {
    id: "risk-ip-gap",
    title: "Missing contractor IP assignment",
    whyItMatters:
      "IP ownership ambiguity is a standard diligence blocker. Acquirers and investors require a clean IP chain of title.",
    recommendation: "Execute IP assignment amendments for all agreements missing clauses.",
    recommendationId: "rec-ip-amendments",
  },
  "finding-board-approval": {
    id: "risk-board-approval",
    title: "Missing board approvals",
    whyItMatters:
      "Undocumented equity grants and material actions create compliance exposure and can delay fundraising.",
    recommendation: "File retroactive board consents before the next board meeting.",
    recommendationId: "rec-board-consents",
  },
  "finding-runway": {
    id: "risk-runway",
    title: "Cash runway risk",
    whyItMatters:
      "Short runway constrains hiring, sales investment, and negotiating leverage with customers and investors.",
    recommendation: "Reduce burn or accelerate collections to extend runway above policy thresholds.",
    recommendationId: "rec-extend-runway",
  },
  "finding-nrr": {
    id: "risk-nrr",
    title: "Net revenue retention risk",
    whyItMatters:
      "NRR below policy threshold signals churn or contraction that compresses valuation multiples and growth forecasts.",
    recommendation: "Launch retention playbooks for contracting cohorts and expand mid-market.",
    recommendationId: "rec-improve-nrr",
  },
  "finding-security-readiness": {
    id: "risk-security",
    title: "Security readiness gaps",
    whyItMatters:
      "Open critical controls and incomplete MFA coverage block enterprise deals and increase breach exposure.",
    recommendation: "Close open critical controls and raise MFA coverage above policy threshold.",
    recommendationId: "rec-security-controls",
  },
  "finding-key-person": {
    id: "risk-key-person",
    title: "Key-person dependency",
    whyItMatters:
      "Single-owner critical functions create operational and diligence risk if that person leaves or is unavailable.",
    recommendation: "Document runbooks and assign secondary owners for each critical function.",
    recommendationId: "rec-key-person",
  },
};

export function assessRisks(findings: Finding[], evidence: Evidence[]): Risk[] {
  const risks: Risk[] = [];

  for (const finding of findings) {
    if (finding.direction !== "negative") continue;

    const template = RISK_TEMPLATES[finding.id];
    if (!template) continue;

    const severity = deriveRiskSeverity(finding.materiality, finding.scoreImpact);
    const primary = evidence.find((e) => finding.evidenceIds.includes(e.id));

    risks.push({
      id: template.id,
      title: template.title,
      summary: finding.description,
      dimensionId: finding.dimensionId,
      dimension: dimensionName(finding.dimensionId),
      severity,
      likelihood: likelihoodFromConfidence(finding.confidence),
      impact: normalizeRiskImpact(finding.scoreImpact),
      findingIds: [finding.id],
      evidenceIds: finding.evidenceIds,
      confidence: finding.confidence,
      status: "open",
      estimatedScoreImpact: Math.abs(finding.scoreImpact),
      whyItMatters: template.whyItMatters,
      recommendationId: template.recommendationId,
      recommendation: template.recommendation,
      primaryEvidenceLabel: primary
        ? formatEvidenceLabel(primary)
        : finding.sourceSystem,
      explainPrompt: `Explain the ${template.title.toLowerCase()} risk and show supporting evidence`,
    });
  }

  return risks;
}
