import { createEvidence } from "../create-evidence";
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
      externalId: "gdrive-board-minutes-may",
      evidence: createEvidence({
        id: "ev-board-minutes",
        sourceSystem: "Google Drive",
        sourceType: "board",
        title: "Board minutes — May 2026",
        contentSummary:
          "Board approved Q2 forecast and mid-market expansion pilot. Governance cleanup report due July 15.",
        extractedFacts: {
          boardMeetingDate: "2026-05-22",
          approvedItems: ["Q2 forecast", "Mid-market expansion pilot"],
        },
        dimensionIds: ["dim-governance"],
        occurredAt: "2026-05-22",
        collectedAt: "Today, 6:30 AM",
        reliability: 89,
      }),
    },
    {
      externalId: "gdrive-soc2-review",
      evidence: createEvidence({
        id: "ev-soc2-review",
        sourceSystem: "Google Drive",
        sourceType: "security",
        title: "SOC 2 control review",
        contentSummary:
          "Internal review passed 42 Type I controls. 3 critical observation windows remain open. MFA coverage at 92%.",
        extractedFacts: {
          openCriticalControls: 3,
          mfaCoverage: 0.92,
          controlsPassed: 42,
        },
        dimensionIds: ["dim-security"],
        occurredAt: "2026-07-03",
        collectedAt: "Yesterday, 4:00 PM",
        reliability: 92,
      }),
    },
    {
      externalId: "gdrive-product-roadmap",
      evidence: createEvidence({
        id: "ev-product-roadmap",
        sourceSystem: "Google Drive",
        sourceType: "product",
        title: "Product roadmap Q3-Q4",
        contentSummary:
          "Q3 roadmap on track with 3 major features shipping on schedule. AI copilot beta launching August.",
        extractedFacts: {
          featuresOnTrack: 3,
          aiCopilotBetaDate: "2026-08-01",
        },
        dimensionIds: ["dim-product"],
        occurredAt: "2026-07-01",
        collectedAt: "Yesterday, 2:15 PM",
        reliability: 85,
      }),
    },
    {
      externalId: "gdrive-ai-readiness",
      evidence: createEvidence({
        id: "ev-ai-readiness",
        sourceSystem: "Google Drive",
        sourceType: "assessment",
        title: "AI readiness assessment",
        contentSummary:
          "Data infrastructure ready. Model governance policies drafted but awaiting board approval.",
        extractedFacts: {
          dataInfrastructureReady: true,
          modelGovernanceApproved: false,
        },
        dimensionIds: ["dim-ai-readiness"],
        occurredAt: "2026-07-05",
        collectedAt: "Jul 5, 2026",
        reliability: 78,
      }),
    },
  ],
});
