/**
 * Company Doctor — application-layer scripted responses for Phase 1.
 * Built from the shared CompanyHealthSnapshot so UI never owns page-local mock data.
 * Real AI integration is Phase 2+.
 */
import {
  companySnapshot,
  evidenceCatalog,
  getRiskById,
  healthScore,
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

export const doctorSuggestedPrompts = [
  "What are the biggest risks?",
  "Why is governance only 71?",
  "What should I fix before fundraising?",
  "Generate a board update.",
  "Show evidence for customer concentration.",
] as const;

function evidenceLabelsForRisk(risk: Risk): string[] {
  const labels = getEvidenceForRisk(companySnapshot, risk).map(formatEvidenceLabel);
  return labels.length > 0 ? labels : [risk.primaryEvidenceLabel];
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
  const [primary, secondary, tertiary] = topRisks;
  const concentration = getRiskById("risk-1");
  const governance = companySnapshot.dimensions.find((d) => d.id === "dim-governance");

  return {
    "What are the biggest risks?": {
      summary: `${risks.length} risks require attention. ${primary?.title ?? "Customer concentration"} is highest priority. Legal and governance gaps should be resolved before fundraising or the July 22 board meeting.`,
      riskLevel: (primary?.level ?? "high") as RiskSeverity,
      evidenceSources: risks.flatMap((r) => evidenceLabelsForRisk(r)).slice(0, 3),
      recommendedAction:
        tertiary && secondary
          ? `Prioritize ${secondary.title.toLowerCase()} and address ${tertiary.title.toLowerCase()} this week.`
          : "Review top risks and execute next best actions from the dashboard.",
    },
    "Why is governance only 71?": (() => {
      const consentRisk = getRiskById("risk-3");
      return {
        summary:
          governance?.summary ??
          "Governance scores 71 due to undocumented option grants and incomplete board consent records.",
        riskLevel: "medium" as RiskSeverity,
        evidenceSources: consentRisk
          ? evidenceLabelsForRisk(consentRisk)
          : ["Carta · Equity grant review", "Google Drive · Board minutes May 2026"],
        recommendedAction:
          consentRisk?.recommendation ??
          "File unanimous written consent for outstanding grants before the next board meeting.",
      };
    })(),
    "What should I fix before fundraising?": {
      summary:
        "Address governance cleanup, contractor IP assignments, and prepare a customer concentration mitigation narrative.",
      riskLevel: "medium",
      evidenceSources: risks.flatMap((r) => evidenceLabelsForRisk(r)).slice(0, 4),
      recommendedAction: "Complete 3 governance fixes and 4 IP amendments within 2 weeks.",
    },
    "Generate a board update.": {
      summary: `Board update draft: Company health at ${healthScore.score} (${healthScore.changeLabel}). Key risks: ${risks.map((r) => r.title.toLowerCase()).join(", ")}.`,
      riskLevel: "low",
      evidenceSources: [
        "QuickBooks · Revenue reconciliation",
        "Google Drive · Board minutes May 2026",
        "HubSpot · ARR cohort analysis",
      ],
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
        : ["HubSpot · ARR cohort analysis"],
      recommendedAction:
        concentration?.recommendation ??
        "Open Evidence Explorer for full ARR cohort analysis.",
    },
  };
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
      summary: `Good morning. I've analyzed ${evidenceCatalog.totalDocuments.toLocaleString()} documents across ${evidenceCatalog.systemsConnected} systems. Company health is ${healthScore.score} (${healthScore.status === "healthy" ? "Healthy" : healthScore.status}, ${healthScore.changeLabel}) with ${healthScore.confidence}% confidence.`,
      riskLevel: "medium",
      evidenceSources: [
        "HubSpot · ARR cohort analysis",
        "QuickBooks · Revenue reconciliation",
        "Carta · Equity grant review",
      ],
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
