import { createMockConnector } from "../create-mock-connector";

export const googleDriveConnector = createMockConnector({
  id: "google-drive",
  name: "Google Drive",
  system: "Google Drive",
  status: "connected",
  lastSynced: "6:30 AM",
  documentsAnalyzed: 312,
  mappings: [
    {
      externalId: "drive-file-board-minutes-may-2026",
      evidence: {
        id: "ev-board-minutes",
        sourceSystem: "Google Drive",
        documentName: "Board minutes — May 2026",
        confidence: 89,
        dimensionId: "dim-governance",
        dimension: "Governance",
        lastReviewed: "Today, 6:30 AM",
        summary:
          "Board approved Q2 forecast and mid-market expansion pilot. Governance cleanup due July 15.",
      },
    },
    {
      externalId: "drive-file-soc2-control-review",
      evidence: {
        id: "ev-soc2-review",
        sourceSystem: "Google Drive",
        documentName: "SOC 2 control review",
        confidence: 92,
        dimensionId: "dim-security",
        dimension: "Security",
        lastReviewed: "Yesterday, 4:00 PM",
        summary:
          "All 42 SOC 2 Type I controls passed internal review. Observation period on track.",
      },
    },
    {
      externalId: "drive-file-product-roadmap-q3-q4",
      evidence: {
        id: "ev-product-roadmap",
        sourceSystem: "Google Drive",
        documentName: "Product roadmap Q3-Q4",
        confidence: 85,
        dimensionId: "dim-product",
        dimension: "Product",
        lastReviewed: "Yesterday, 2:15 PM",
        summary:
          "3 major features on track for Q3. AI copilot beta launching August. NPS target: 52.",
      },
    },
    {
      externalId: "drive-file-ai-readiness-assessment",
      evidence: {
        id: "ev-ai-readiness",
        sourceSystem: "Google Drive",
        documentName: "AI readiness assessment",
        confidence: 78,
        dimensionId: "dim-ai-readiness",
        dimension: "AI Readiness",
        lastReviewed: "Jul 5, 2026",
        summary:
          "Data infrastructure ready. Model governance policies drafted but not yet approved by board.",
      },
    },
  ],
});
