/**
 * Company Doctor — scripted responses generated from Insight Engine output.
 * Answers cite evidence IDs from the current snapshot. No external AI API yet.
 */
import {
  companySnapshot,
  evidenceCatalog,
  getRiskById,
  healthScore,
  recommendations,
  risks,
  topRisks,
} from "@/lib/data";
import {
  formatEvidenceLabel,
  getEvidenceForRisk,
  type Risk,
  type RiskSeverity,
} from "@/lib/domain";
import type { DoctorMessage, DoctorResponse } from "@/lib/types";

const governance = companySnapshot.dimensions.find((d) => d.id === "dim-governance");
const governanceScore = governance?.score ?? healthScore.score;

export const doctorSuggestedPrompts = [
  "What are the biggest risks?",
  `Why is governance only ${governanceScore}?`,
  "What should I fix before fundraising?",
  "Generate a board update.",
  "Show evidence for customer concentration.",
] as const;

function citeEvidenceIds(ids: string[]): string[] {
  return ids.map((id) => {
    const item = companySnapshot.evidence.find((e) => e.id === id);
    return item ? `${formatEvidenceLabel(item)} [${id}]` : id;
  });
}

function evidenceLabelsForRisk(risk: Risk): string[] {
  const fromLinks = getEvidenceForRisk(companySnapshot, risk);
  if (fromLinks.length > 0) {
    return fromLinks.map((e) => `${formatEvidenceLabel(e)} [${e.id}]`);
  }
  return citeEvidenceIds(risk.evidenceIds);
}

function riskToDoctorResponse(risk: Risk): DoctorResponse {
  return {
    summary: `${risk.summary} ${risk.whyItMatters}`,
    riskLevel: risk.severity,
    evidenceSources: evidenceLabelsForRisk(risk),
    recommendedAction: risk.recommendation,
  };
}

function buildDoctorResponses(): Record<string, DoctorResponse> {
  const [primary] = topRisks;
  const concentration = getRiskById("risk-concentration");
  const boardRisk = getRiskById("risk-board-approval");
  const topRecs = recommendations.slice(0, 3);

  const responses: Record<string, DoctorResponse> = {
    "What are the biggest risks?": {
      summary: `${risks.length} risks require attention. ${primary?.title ?? "Customer concentration"} is highest priority. ${risks
        .map((r) => r.title)
        .join("; ")}.`,
      riskLevel: (primary?.level ?? "high") as RiskSeverity,
      evidenceSources: risks.flatMap((r) => evidenceLabelsForRisk(r)).slice(0, 4),
      recommendedAction:
        topRecs.length > 0
          ? `Prioritize: ${topRecs.map((r) => r.title).join("; ")}.`
          : "Review top risks and execute next best actions from the dashboard.",
    },
    "What should I fix before fundraising?": {
      summary: `Before fundraising, address: ${risks.map((r) => r.title).join(", ")}. Engine confidence ${healthScore.confidence}%.`,
      riskLevel: (primary?.level ?? "medium") as RiskSeverity,
      evidenceSources: risks.flatMap((r) => evidenceLabelsForRisk(r)).slice(0, 5),
      recommendedAction:
        topRecs.map((r) => r.title).join("; ") ||
        "Complete governance and IP remediation within 2 weeks.",
    },
    "Generate a board update.": {
      summary: `Board update draft: Company health at ${healthScore.score} (${healthScore.changeLabel}). Key risks: ${risks.map((r) => r.title.toLowerCase()).join(", ")}. Evidence cited: ${companySnapshot.evidence
        .slice(0, 3)
        .map((e) => e.id)
        .join(", ")}.`,
      riskLevel: "low",
      evidenceSources: companySnapshot.evidence.slice(0, 4).map(
        (e) => `${formatEvidenceLabel(e)} [${e.id}]`,
      ),
      recommendedAction:
        "Review generated board update in Executive Brief. Export PDF and send to board distribution list.",
    },
    "Show evidence for customer concentration.": {
      summary:
        concentration?.summary ??
        "HubSpot ARR cohort analysis shows elevated top-customer ARR share.",
      riskLevel: (concentration?.severity ?? "high") as RiskSeverity,
      evidenceSources: concentration
        ? evidenceLabelsForRisk(concentration)
        : citeEvidenceIds(["ev-arr-cohort"]),
      recommendedAction:
        concentration?.recommendation ??
        "Open Evidence Explorer for full ARR cohort analysis.",
    },
  };

  // Dynamic governance prompt keyed to current engine score
  const governancePrompt = `Why is governance only ${governanceScore}?`;
  responses[governancePrompt] = {
    summary:
      governance?.summary ??
      `Governance scores ${governanceScore} due to missing board approvals on option grants.`,
    riskLevel: (boardRisk?.severity ?? "medium") as RiskSeverity,
    evidenceSources: boardRisk
      ? evidenceLabelsForRisk(boardRisk)
      : citeEvidenceIds(["ev-equity-grants"]),
    recommendedAction:
      boardRisk?.recommendation ??
      "File unanimous written consent for outstanding grants before the next board meeting.",
  };

  return responses;
}

export const doctorResponses: Record<string, DoctorResponse | undefined> =
  buildDoctorResponses();

export const doctorInitialMessages: DoctorMessage[] = [
  {
    id: "msg-0",
    role: "assistant",
    content: "",
    timestamp: "6:40 AM",
    response: {
      summary: `Good morning. I've analyzed ${evidenceCatalog.totalDocuments.toLocaleString()} documents across ${evidenceCatalog.systemsConnected} systems via the Insight Engine. Company health is ${healthScore.score} (${healthScore.status === "healthy" ? "Healthy" : healthScore.status}, ${healthScore.changeLabel}) with ${healthScore.confidence}% confidence. ${risks.length} active risks; top evidence: ${companySnapshot.evidence
        .slice(0, 3)
        .map((e) => e.id)
        .join(", ")}.`,
      riskLevel: (topRisks[0]?.level ?? "medium") as RiskSeverity,
      evidenceSources: companySnapshot.evidence.slice(0, 3).map(
        (e) => `${formatEvidenceLabel(e)} [${e.id}]`,
      ),
      recommendedAction:
        "Review today's Executive Brief for the full picture, or ask me about any specific dimension or risk.",
    },
  },
];

/** Explain flows derived from domain Risk entities. */
export function getDoctorExplainResponse(riskId: string): DoctorResponse | undefined {
  const risk = getRiskById(riskId);
  if (!risk) return undefined;
  return riskToDoctorResponse(risk);
}

export function getDoctorExplainPrompt(riskId: string): string {
  const risk = getRiskById(riskId);
  return risk?.explainPrompt ?? "Explain this risk";
}

export const doctorDocumentCount = evidenceCatalog.totalDocuments;
export const doctorSystemsConnected = evidenceCatalog.systemsConnected;
