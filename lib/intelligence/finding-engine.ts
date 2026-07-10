/**
 * Finding Engine — Insights → Findings.
 * Groups related insights into material observations with direction and score impact.
 */

import type { Evidence, Finding, FindingDirection, Insight } from "@/lib/domain";
import { DIMENSION_NAMES } from "./rules";

function dimName(id: string): string {
  return DIMENSION_NAMES[id] ?? id;
}

function primarySource(evidence: Evidence[], evidenceIds: string[]): string {
  const first = evidence.find((e) => evidenceIds.includes(e.id));
  return first?.sourceSystem ?? "Unknown";
}

function collectedAt(evidence: Evidence[], evidenceIds: string[]): string {
  const first = evidence.find((e) => evidenceIds.includes(e.id));
  return first?.collectedAt ?? "Unknown";
}

function makeFinding(params: {
  id: string;
  title: string;
  description: string;
  dimensionId: string;
  insights: Insight[];
  direction: FindingDirection;
  materiality: number;
  scoreImpact: number;
  evidence: Evidence[];
}): Finding {
  const evidenceIds = [...new Set(params.insights.flatMap((i) => i.evidenceIds))];
  const confidence = Math.round(
    params.insights.reduce((sum, i) => sum + i.confidence, 0) / params.insights.length,
  );

  return {
    id: params.id,
    title: params.title,
    description: params.description,
    dimensionId: params.dimensionId,
    dimension: dimName(params.dimensionId),
    insightIds: params.insights.map((i) => i.id),
    evidenceIds,
    direction: params.direction,
    materiality: params.materiality,
    confidence,
    scoreImpact: params.scoreImpact,
    summary: params.description,
    extractedAt: collectedAt(params.evidence, evidenceIds),
    sourceSystem: primarySource(params.evidence, evidenceIds),
  };
}

/**
 * Convert insights into findings. One finding per insight rule family
 * (deduped by dimension + rule prefix) so scoring stays stable.
 */
export function deriveFindings(insights: Insight[], evidence: Evidence[]): Finding[] {
  const findings: Finding[] = [];

  const byPrefix = (prefix: string) =>
    insights.filter((i) => i.id.startsWith(prefix));

  const concentration = byPrefix("insight-concentration-");
  if (concentration.length > 0) {
    const high = concentration.some((i) => i.statement.includes("high-risk"));
    findings.push(
      makeFinding({
        id: "finding-concentration",
        title: high
          ? "Revenue concentration above 50% threshold"
          : "Elevated customer concentration",
        description: concentration.map((i) => i.statement).join(" "),
        dimensionId: "dim-customer",
        insights: concentration,
        direction: "negative",
        materiality: high ? 9 : 6,
        scoreImpact: high ? -8 : -4,
        evidence,
      }),
    );
  }

  const ipGaps = byPrefix("insight-ip-gap-");
  if (ipGaps.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-ip-gap",
        title: "Missing intellectual-property assignments",
        description: ipGaps.map((i) => i.statement).join(" "),
        dimensionId: "dim-legal",
        insights: ipGaps,
        direction: "negative",
        materiality: 7,
        scoreImpact: -6,
        evidence,
      }),
    );
  }

  const board = byPrefix("insight-board-approval-");
  if (board.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-board-approval",
        title: "Missing board approvals",
        description: board.map((i) => i.statement).join(" "),
        dimensionId: "dim-governance",
        insights: board,
        direction: "negative",
        materiality: 8,
        scoreImpact: -14,
        evidence,
      }),
    );
  }

  const runway = byPrefix("insight-runway-");
  if (runway.length > 0) {
    const positive = runway.every((i) => i.type === "positive");
    const highRisk = runway.some((i) => i.statement.includes("high-risk"));
    findings.push(
      makeFinding({
        id: "finding-runway",
        title: positive ? "Strong cash runway" : "Cash runway concern",
        description: runway.map((i) => i.statement).join(" "),
        dimensionId: "dim-financial",
        insights: runway,
        direction: positive ? "positive" : "negative",
        materiality: positive ? 5 : highRisk ? 9 : 6,
        scoreImpact: positive ? 5 : highRisk ? -12 : -6,
        evidence,
      }),
    );
  }

  const recurring = byPrefix("insight-recurring-");
  if (recurring.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-recurring-revenue",
        title: "High recurring revenue quality",
        description: recurring.map((i) => i.statement).join(" "),
        dimensionId: "dim-revenue-quality",
        insights: recurring,
        direction: "positive",
        materiality: 5,
        scoreImpact: 4,
        evidence,
      }),
    );
  }

  const nrr = byPrefix("insight-nrr-");
  if (nrr.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-nrr",
        title: "Net revenue retention below threshold",
        description: nrr.map((i) => i.statement).join(" "),
        dimensionId: "dim-revenue-quality",
        insights: nrr,
        direction: "negative",
        materiality: 8,
        scoreImpact: -8,
        evidence,
      }),
    );
  }

  const critical = byPrefix("insight-critical-controls-");
  const mfa = byPrefix("insight-mfa-");
  const securityInsights = [...critical, ...mfa];
  if (securityInsights.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-security-readiness",
        title: "Security readiness gaps",
        description: securityInsights.map((i) => i.statement).join(" "),
        dimensionId: "dim-security",
        insights: securityInsights,
        direction: "negative",
        materiality: 7,
        scoreImpact: -8,
        evidence,
      }),
    );
  }

  const attrition = byPrefix("insight-attrition-");
  if (attrition.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-low-attrition",
        title: "Low voluntary attrition",
        description: attrition.map((i) => i.statement).join(" "),
        dimensionId: "dim-people",
        insights: attrition,
        direction: "positive",
        materiality: 4,
        scoreImpact: 5,
        evidence,
      }),
    );
  }

  const keyPerson = byPrefix("insight-key-person-");
  if (keyPerson.length > 0) {
    findings.push(
      makeFinding({
        id: "finding-key-person",
        title: "Key-person dependency",
        description: keyPerson.map((i) => i.statement).join(" "),
        dimensionId: "dim-people",
        insights: keyPerson,
        direction: "negative",
        materiality: 7,
        scoreImpact: -5,
        evidence,
      }),
    );
  }

  // Link findings back onto insights for UI reverse lookups
  for (const finding of findings) {
    for (const insight of insights) {
      if (finding.insightIds.includes(insight.id)) {
        insight.findingIds = [...new Set([...insight.findingIds, finding.id])];
      }
    }
  }

  return findings;
}
