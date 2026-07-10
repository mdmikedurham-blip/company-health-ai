import { createMockConnector } from "../create-mock-connector";
import { mockEvidence } from "@/lib/data/mock-evidence";

function evidenceById(id: string) {
  const item = mockEvidence.find((e) => e.id === id);
  if (!item) throw new Error(`Missing mock evidence ${id}`);
  return item;
}

export const quickbooksConnector = createMockConnector({
  id: "quickbooks",
  name: "QuickBooks",
  system: "QuickBooks",
  status: "connected",
  lastSynced: "6:15 AM",
  documentsAnalyzed: 94,
  mappings: [
    { externalId: "qb-cash-runway", evidence: evidenceById("ev-cash-runway") },
  ],
});
