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
      externalId: "carta-equity-grant-review-q2-2024",
      evidence: {
        id: "ev-equity-grants",
        sourceSystem: "Carta",
        documentName: "Equity grant review",
        confidence: 97,
        dimensionId: "dim-governance",
        dimension: "Governance",
        lastReviewed: "Today, 6:10 AM",
        summary:
          "3 option grants from Q2 2024 lack documented board consent in Carta.",
      },
    },
  ],
});
