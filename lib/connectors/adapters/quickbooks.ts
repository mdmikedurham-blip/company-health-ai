import { createEvidence } from "../create-evidence";
import { createMockConnector } from "../create-mock-connector";

export const quickbooksConnector = createMockConnector({
  id: "quickbooks",
  name: "QuickBooks",
  system: "QuickBooks",
  status: "connected",
  lastSynced: "6:15 AM",
  documentsAnalyzed: 94,
  mappings: [
    {
      externalId: "qb-cash-runway",
      evidence: createEvidence({
        id: "ev-cash-runway",
        sourceSystem: "QuickBooks",
        sourceType: "financial",
        title: "Cash runway forecast",
        contentSummary:
          "Cash position $3.4M. Burn implies 14.2 months runway at current spend.",
        extractedFacts: {
          cashRunwayMonths: 14.2,
          cashBalance: 3_400_000,
        },
        dimensionIds: ["dim-financial"],
        occurredAt: "2026-07-05",
        collectedAt: "Today, 6:15 AM",
        reliability: 98,
      }),
    },
  ],
});
