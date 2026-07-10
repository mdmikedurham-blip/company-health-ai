import { createEvidence } from "../create-evidence";
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
      externalId: "box-legal-folder-audit",
      evidence: createEvidence({
        id: "ev-legal-audit",
        sourceSystem: "Box",
        sourceType: "audit",
        title: "Legal folder audit",
        contentSummary:
          "4 of 12 active contractor agreements lack signed IP assignment clauses (C-104, C-108, C-111, C-115).",
        extractedFacts: {
          agreementsMissingIpAssignment: 4,
          totalContractorAgreements: 12,
          missingAgreementIds: ["C-104", "C-108", "C-111", "C-115"],
        },
        dimensionIds: ["dim-legal"],
        occurredAt: "2026-06-15",
        collectedAt: "Today, 6:28 AM",
        reliability: 91,
      }),
    },
  ],
});
