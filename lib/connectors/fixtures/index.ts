import type { ConnectorId, Evidence } from "@/lib/domain";
import type { EvidenceConnector } from "@/lib/connectors/types";
import { FIXTURE_EVIDENCE } from "@/lib/connectors/fixtures/evidence";

/**
 * Fixture connector that filters shared evidence by connector id.
 * Real connectors (OAuth + API sync) will replace these without changing
 * the Insight Engine or UI contracts.
 */
function createFixtureConnector(
  id: ConnectorId,
  displayName: string,
): EvidenceConnector {
  return {
    id,
    displayName,
    async collect(): Promise<Evidence[]> {
      return FIXTURE_EVIDENCE.filter((e) => e.connectorId === id);
    },
  };
}

export const googleDriveConnector = createFixtureConnector(
  "google_drive",
  "Google Drive",
);
export const boxConnector = createFixtureConnector("box", "Box");
export const quickbooksConnector = createFixtureConnector(
  "quickbooks",
  "QuickBooks",
);
export const cartaConnector = createFixtureConnector("carta", "Carta");
export const hubspotConnector = createFixtureConnector("hubspot", "HubSpot");

export const DEFAULT_CONNECTORS: EvidenceConnector[] = [
  googleDriveConnector,
  boxConnector,
  quickbooksConnector,
  cartaConnector,
  hubspotConnector,
];
