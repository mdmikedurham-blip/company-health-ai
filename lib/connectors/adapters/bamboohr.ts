import { createEvidence } from "../create-evidence";
import { createMockConnector } from "../create-mock-connector";

export const bambooHrConnector = createMockConnector({
  id: "bamboohr",
  name: "BambooHR",
  system: "BambooHR",
  status: "connected",
  lastSynced: "Jul 2",
  documentsAnalyzed: 45,
  mappings: [
    {
      externalId: "bamboohr-q2-people-health",
      evidence: createEvidence({
        id: "ev-people-health",
        sourceSystem: "BambooHR",
        sourceType: "hr",
        title: "Q2 people health report",
        contentSummary:
          "Zero voluntary attrition in Q2. Infrastructure and payments on-call owned by a single engineer.",
        extractedFacts: {
          voluntaryAttritionRate: 0,
          singleOwnerCriticalFunctions: [
            "Infrastructure on-call",
            "Payments reconciliation",
          ],
          headcount: 84,
        },
        dimensionIds: ["dim-people"],
        occurredAt: "2026-06-30",
        collectedAt: "Jul 2, 2026",
        reliability: 90,
      }),
    },
  ],
});
