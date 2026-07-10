import { createMockConnector } from "../create-mock-connector";
import { mockEvidence } from "@/lib/data/mock-evidence";

function evidenceById(id: string) {
  const item = mockEvidence.find((e) => e.id === id);
  if (!item) throw new Error(`Missing mock evidence ${id}`);
  return item;
}

export const boxConnector = createMockConnector({
  id: "box",
  name: "Box",
  system: "Box",
  status: "connected",
  lastSynced: "6:28 AM",
  documentsAnalyzed: 189,
  mappings: [
    { externalId: "box-legal-folder-audit", evidence: evidenceById("ev-legal-audit") },
  ],
});
