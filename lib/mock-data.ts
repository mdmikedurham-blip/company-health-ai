/**
 * @deprecated Import from @/lib/data instead.
 * Thin re-export layer for backward compatibility during Phase 1 migration.
 */
export {
  company,
  companySnapshot,
  dashboardMetrics,
  dimensionSummaries,
  dimensions,
  dimensions as healthDimensionDetails,
  evidence as evidenceItems,
  evidenceCatalog,
  evidenceGraphEdges,
  evidenceGraphNodes,
  evidenceRecords,
  executiveBrief,
  findings,
  getDimensionById,
  getEvidenceById,
  getRiskById,
  healthScore,
  healthDimensions,
  insights,
  insights as aiInsights,
  nextBestActions,
  recommendations,
  recommendations as recommendedActions,
  reports,
  risks,
  scoreChangeExplanation,
  timelineEvents,
  topRisks,
  resolveEvidenceLabels,
} from "@/lib/data";

export const evidenceSummary = {
  get totalDocuments() {
    return companySnapshot.evidenceCatalog.totalDocuments;
  },
  get systemsConnected() {
    return companySnapshot.evidenceCatalog.systemsConnected;
  },
  get lastFullScan() {
    return companySnapshot.evidenceCatalog.lastFullScan;
  },
  get sources() {
    return companySnapshot.evidenceCatalog.connectors;
  },
};

import { companySnapshot } from "@/lib/data";

// Company Doctor — application layer, not core domain (Phase 2+)
export const doctorSuggestedPrompts = [
  "What are the biggest risks?",
  "Why is governance only 71?",
  "What should I fix before fundraising?",
  "Generate a board update.",
  "Show evidence for customer concentration.",
];

export const doctorResponses: Record<string, import("./types").DoctorResponse | undefined> = {
  "What are the biggest risks?": {
    summary:
      "Three risks require attention. Customer concentration is highest priority—58% ARR in top 3 accounts. Legal and governance gaps should be resolved before fundraising or the July 22 board meeting.",
    riskLevel: "high",
    evidenceSources: [
      "HubSpot · ARR cohort analysis",
      "Box · Legal folder audit",
      "Carta · Equity grant review",
    ],
    recommendedAction:
      "Prioritize mid-market diversification plan and execute IP assignment amendments this week. File retroactive board consents by July 15.",
  },
  "Why is governance only 71?": {
    summary:
      "Governance scores 71 due to three undocumented option grants from Q2 2024 and incomplete board consent records.",
    riskLevel: "medium",
    evidenceSources: ["Carta · Equity grant review", "Google Drive · Board minutes May 2026"],
    recommendedAction:
      "File unanimous written consent for grants #14, #22, and #31. Legal counsel draft is ready in Box.",
  },
  "What should I fix before fundraising?": {
    summary:
      "Address governance cleanup, contractor IP assignments, and prepare a customer concentration mitigation narrative.",
    riskLevel: "medium",
    evidenceSources: [
      "Carta · Equity grant review",
      "Box · Legal folder audit",
      "QuickBooks · Revenue reconciliation",
      "HubSpot · ARR cohort analysis",
    ],
    recommendedAction: "Complete 3 governance fixes and 4 IP amendments within 2 weeks.",
  },
  "Generate a board update.": {
    summary:
      "Board update draft: Company health at 87 (+5). Q2 financials closed early. Key risks: customer concentration, governance cleanup needed.",
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
      "HubSpot ARR cohort analysis shows top 3 customers at 58% of total ARR ($4.2M of $7.2M). Meridian Corp (24%) renews in 90 days.",
    riskLevel: "high",
    evidenceSources: ["HubSpot · ARR cohort analysis", "HubSpot · Customer contract records"],
    recommendedAction:
      "Open Evidence Explorer for full ARR cohort analysis. Initiate mid-market expansion pilot.",
  },
};

export const doctorInitialMessages: import("./types").DoctorMessage[] = [
  {
    id: "msg-0",
    role: "assistant",
    content: "",
    timestamp: "6:40 AM",
    response: {
      summary:
        "Good morning. I've analyzed 1,247 documents across 5 systems. Company health is 87 (Healthy, +5 this month) with 96% confidence.",
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

export const doctorExplainResponses: Record<string, import("./types").DoctorResponse> = {
  "risk-1": {
    summary:
      "Customer concentration is your highest-severity risk. Top 3 accounts represent 58% of ARR.",
    riskLevel: "high",
    evidenceSources: ["HubSpot · ARR cohort analysis"],
    recommendedAction:
      "Launch mid-market expansion pilot. Set target to reduce top-3 below 45% by Q4.",
  },
  "risk-2": {
    summary: "Four active contractor agreements lack signed IP assignment clauses.",
    riskLevel: "medium",
    evidenceSources: ["Box · Legal folder audit"],
    recommendedAction:
      "Send IP assignment amendments to contractors C-104, C-108, C-111, and C-115 this week.",
  },
  "risk-3": {
    summary: "Three option grants from Q2 2024 are missing board consent documentation.",
    riskLevel: "medium",
    evidenceSources: ["Carta · Equity grant review", "Google Drive · Board minutes May 2026"],
    recommendedAction: "File retroactive unanimous written consent before the July 22 board meeting.",
  },
};
