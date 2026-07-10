/**
 * Recommendation Engine — Risks → prioritized Recommendations.
 *
 * priorityScore =
 *   estimatedScoreImprovement × risk severity multiplier × confidence
 *   ÷ effort multiplier
 */

import type {
  ActionPriority,
  EffortLevel,
  Finding,
  Recommendation,
  Risk,
  RiskSeverity,
} from "@/lib/domain";
import { DIMENSION_NAMES, EFFORT_MULTIPLIER, SEVERITY_MULTIPLIER } from "./rules";

function dimName(id: string): string {
  return DIMENSION_NAMES[id] ?? id;
}

function priorityFromScore(score: number): ActionPriority {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

interface RecTemplate {
  title: string;
  description: string;
  effort: EffortLevel;
  rationale: string;
  nextSteps: string[];
}

const REC_TEMPLATES: Record<string, RecTemplate> = {
  "rec-diversify-customers": {
    title: "Diversify top-customer exposure",
    description:
      "Launch mid-market expansion to reduce top-3 ARR concentration below the 45% target.",
    effort: "high",
    rationale: "Concentration above investor thresholds is the largest customer-dimension drag.",
    nextSteps: [
      "Identify 20 mid-market prospects in active pipeline",
      "Assign AE capacity to diversification pilot",
      "Report top-3 share monthly to the board",
    ],
  },
  "rec-ip-amendments": {
    title: "Execute IP assignment amendments",
    description:
      "Send updated contractor and employee agreements covering missing IP assignment clauses.",
    effort: "low",
    rationale: "IP gaps are a standard diligence blocker and are inexpensive to remediate.",
    nextSteps: [
      "Generate amendment pack from legal template",
      "Send to all counterparties missing clauses",
      "Track signed returns in the contract repository",
    ],
  },
  "rec-board-consents": {
    title: "File retroactive board consents",
    description:
      "Prepare and execute unanimous written consent for option grants and material actions lacking approval.",
    effort: "medium",
    rationale: "Undocumented grants create compliance exposure ahead of fundraising and board meetings.",
    nextSteps: [
      "Draft unanimous written consent with counsel",
      "Circulate for director signatures",
      "Attach executed consents in Carta and board minutes",
    ],
  },
  "rec-extend-runway": {
    title: "Extend cash runway",
    description: "Reduce burn or accelerate collections to push runway above 12 months.",
    effort: "high",
    rationale: "Runway below thresholds constrains hiring and negotiating leverage.",
    nextSteps: [
      "Re-forecast burn under base and downside cases",
      "Identify discretionary spend cuts",
      "Accelerate AR collections on top accounts",
    ],
  },
  "rec-improve-nrr": {
    title: "Improve net revenue retention",
    description: "Deploy retention and expansion playbooks for contracting cohorts.",
    effort: "medium",
    rationale: "NRR below 90% compresses valuation and growth forecasts.",
    nextSteps: [
      "Segment contracting accounts by reason code",
      "Assign CS owners to at-risk logos",
      "Launch expansion offers for healthy cohorts",
    ],
  },
  "rec-security-controls": {
    title: "Close security control gaps",
    description: "Remediate open critical controls and raise MFA coverage above 95%.",
    effort: "medium",
    rationale: "Security gaps block enterprise deals and elevate breach exposure.",
    nextSteps: [
      "Prioritize open critical controls by severity",
      "Enforce MFA on remaining accounts",
      "Re-run control attestation",
    ],
  },
  "rec-key-person": {
    title: "Reduce key-person dependency",
    description: "Document runbooks and assign secondary owners for single-owner critical functions.",
    effort: "medium",
    rationale: "Single-owner functions create operational and diligence risk.",
    nextSteps: [
      "List critical functions with a single owner",
      "Assign secondary owners and schedule knowledge transfer",
      "Publish runbooks in the ops wiki",
    ],
  },
};

export function computePriorityScore(params: {
  estimatedScoreImprovement: number;
  severity: RiskSeverity;
  confidence: number;
  effort: EffortLevel;
}): number {
  const { estimatedScoreImprovement, severity, confidence, effort } = params;
  const raw =
    (estimatedScoreImprovement *
      SEVERITY_MULTIPLIER[severity] *
      (confidence / 100)) /
    EFFORT_MULTIPLIER[effort];
  return Math.round(raw * 100) / 100;
}

export function generateRecommendations(
  risks: Risk[],
  findings: Finding[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const risk of risks) {
    const template = REC_TEMPLATES[risk.recommendationId];
    if (!template) continue;

    const relatedFindings = findings.filter((f) => risk.findingIds.includes(f.id));
    const estimatedScoreImprovement = risk.estimatedScoreImpact;
    const priorityScore = computePriorityScore({
      estimatedScoreImprovement,
      severity: risk.severity,
      confidence: risk.confidence,
      effort: template.effort,
    });

    recommendations.push({
      id: risk.recommendationId,
      title: template.title,
      description: template.description,
      dimensionId: risk.dimensionId,
      dimension: dimName(risk.dimensionId),
      riskIds: [risk.id],
      evidenceIds: risk.evidenceIds,
      priority: priorityFromScore(priorityScore),
      effort: template.effort,
      confidence: risk.confidence,
      estimatedScoreImprovement,
      rationale: template.rationale,
      nextSteps: template.nextSteps,
      priorityScore,
      supportingEvidenceIds: risk.evidenceIds,
      findingIds: relatedFindings.map((f) => f.id),
      estimatedHealthImpact: estimatedScoreImprovement,
    });
  }

  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}

/** Attach recommendation titles onto dimension profiles for UI cards. */
export function attachRecommendationsToDimensions(
  dimensions: { id: string; recommendedActions: string[] }[],
  recommendations: Recommendation[],
): void {
  for (const dim of dimensions) {
    const actions = recommendations
      .filter((r) => r.dimensionId === dim.id)
      .map((r) => r.title);
    if (actions.length > 0) {
      dim.recommendedActions = actions;
    }
  }
}
