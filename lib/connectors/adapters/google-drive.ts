import { createMockConnector } from "../create-mock-connector";
import { mockEvidence } from "@/lib/data/mock-evidence";

function evidenceById(id: string) {
  const item = mockEvidence.find((e) => e.id === id);
  if (!item) throw new Error(`Missing mock evidence ${id}`);
  return item;
}

export const googleDriveConnector = createMockConnector({
  id: "google-drive",
  name: "Google Drive",
  system: "Google Drive",
  status: "connected",
  lastSynced: "6:30 AM",
  documentsAnalyzed: 312,
  mappings: [
    { externalId: "gdrive-board-minutes-may", evidence: evidenceById("ev-board-minutes") },
    { externalId: "gdrive-soc2-review", evidence: evidenceById("ev-soc2-review") },
    { externalId: "gdrive-product-roadmap", evidence: evidenceById("ev-product-roadmap") },
    { externalId: "gdrive-ai-readiness", evidence: evidenceById("ev-ai-readiness") },
  ],
});
