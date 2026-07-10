import { createEvidence } from "../create-evidence";
import { createMockConnector } from "../create-mock-connector";

export const hubspotConnector = createMockConnector({
  id: "hubspot",
  name: "HubSpot",
  system: "HubSpot",
  status: "connected",
  lastSynced: "6:32 AM",
  documentsAnalyzed: 605,
  mappings: [
    {
      externalId: "hubspot-report-arr-cohort-q2",
      evidence: createEvidence({
        id: "ev-arr-cohort",
        sourceSystem: "HubSpot",
        sourceType: "report",
        title: "ARR cohort analysis",
        contentSummary:
          "Top 3 customers account for 58% of ARR ($4.2M of $7.2M). Meridian Corp alone represents 24%.",
        extractedFacts: {
          top3CustomerArrShare: 0.58,
          topCustomerArrShare: 0.24,
          topCustomerName: "Meridian Corp",
          totalArr: 7_200_000,
        },
        dimensionIds: ["dim-customer", "dim-revenue-quality"],
        occurredAt: "2026-07-01",
        collectedAt: "Today, 6:32 AM",
        reliability: 94,
      }),
    },
    {
      externalId: "hubspot-revenue-quality",
      evidence: createEvidence({
        id: "ev-revenue-quality",
        sourceSystem: "HubSpot",
        sourceType: "report",
        title: "Revenue quality dashboard",
        contentSummary:
          "88% recurring revenue. Net revenue retention at 108%. Mid-market expansion improving cohort retention.",
        extractedFacts: {
          recurringRevenueShare: 0.88,
          netRevenueRetention: 1.08,
        },
        dimensionIds: ["dim-revenue-quality"],
        occurredAt: "2026-07-01",
        collectedAt: "Today, 6:20 AM",
        reliability: 93,
      }),
    },
  ],
});
