import { createMockConnector } from "../create-mock-connector";
import { mockEvidence } from "@/lib/data/mock-evidence";

function evidenceById(id: string) {
  const item = mockEvidence.find((e) => e.id === id);
  if (!item) throw new Error(`Missing mock evidence ${id}`);
  return item;
}

export const cartaConnector = createMockConnector({
  id: "carta",
  name: "Carta",
  system: "Carta",
  status: "connected",
  lastSynced: "6:10 AM",
  documentsAnalyzed: 47,
  mappings: [
    { externalId: "carta-equity-grant-review", evidence: evidenceById("ev-equity-grants") },
  ],
});
