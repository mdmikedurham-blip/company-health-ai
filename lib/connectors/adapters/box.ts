import { createMockConnector } from "../create-mock-connector";

export const boxConnector = createMockConnector({
  id: "box",
  name: "Box",
  system: "Box",
  status: "connected",
  lastSynced: "6:28 AM",
  documentsAnalyzed: 189,
  mappings: [
    {
      externalId: "box-folder-legal-audit-2026-q3",
      evidence: {
        id: "ev-legal-audit",
        sourceSystem: "Box",
        documentName: "Legal folder audit",
        confidence: 91,
        dimensionId: "dim-legal",
        dimension: "Legal",
        lastReviewed: "Today, 6:28 AM",
        summary:
          "12 active contractor agreements reviewed. 4 missing signed IP assignment clauses.",
      },
    },
  ],
});
