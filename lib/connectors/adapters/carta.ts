import { createEvidence } from "../create-evidence";
import { createMockConnector } from "../create-mock-connector";

export const cartaConnector = createMockConnector({
  id: "carta",
  name: "Carta",
  system: "Carta",
  status: "connected",
  lastSynced: "6:10 AM",
  documentsAnalyzed: 47,
  mappings: [
    {
      externalId: "carta-equity-grant-review",
      evidence: createEvidence({
        id: "ev-equity-grants",
        sourceSystem: "Carta",
        sourceType: "equity",
        title: "Equity grant review",
        contentSummary:
          "3 option grants from Q2 2024 lack documented board consent in Carta.",
        extractedFacts: {
          optionGrantsMissingBoardApproval: 3,
          materialActionsMissingBoardApproval: false,
          grantPeriods: ["Q2 2024"],
        },
        dimensionIds: ["dim-governance"],
        occurredAt: "2026-06-20",
        collectedAt: "Today, 6:10 AM",
        reliability: 97,
      }),
    },
  ],
});
