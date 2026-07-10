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
      evidence: {
        id: "ev-arr-cohort",
        sourceSystem: "HubSpot",
        documentName: "ARR cohort analysis",
        confidence: 94,
        dimensionId: "dim-customer",
        dimension: "Customer",
        lastReviewed: "Today, 6:32 AM",
        summary:
          "Top 3 customers account for 58% of ARR ($4.2M of $7.2M). Meridian Corp alone represents 24%.",
      },
    },
  ],
});
