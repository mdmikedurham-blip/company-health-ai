import { createMockConnector } from "../create-mock-connector";
import { mockEvidence } from "@/lib/data/mock-evidence";

function evidenceById(id: string) {
  const item = mockEvidence.find((e) => e.id === id);
  if (!item) throw new Error(`Missing mock evidence ${id}`);
  return item;
}

export const hubspotConnector = createMockConnector({
  id: "hubspot",
  name: "HubSpot",
  system: "HubSpot",
  status: "connected",
  lastSynced: "6:32 AM",
  documentsAnalyzed: 605,
  mappings: [
    { externalId: "hubspot-report-arr-cohort-q2", evidence: evidenceById("ev-arr-cohort") },
    {
      externalId: "hubspot-revenue-quality",
      evidence: evidenceById("ev-revenue-quality"),
    },
  ],
});
