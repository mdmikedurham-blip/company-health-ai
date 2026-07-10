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
      externalId: "qb-revenue-reconciliation-q2-2026",
      evidence: {
        id: "ev-revenue-recon",
        sourceSystem: "QuickBooks",
        documentName: "Revenue reconciliation",
        confidence: 98,
        dimensionId: "dim-financial",
        dimension: "Financial",
        lastReviewed: "Today, 6:15 AM",
        summary:
          "Q2 recognized revenue ($1.82M) reconciled to HubSpot. Variance under 0.3%. Cash: $3.4M.",
      },
    },
  ],
});
