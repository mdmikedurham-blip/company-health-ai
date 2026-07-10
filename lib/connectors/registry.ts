import {
  boxConnector,
  cartaConnector,
  googleDriveConnector,
  hubspotConnector,
  quickbooksConnector,
  slackConnector,
} from "./adapters";
import type { ConnectorId, HealthConnector } from "./types";

const connectorRegistry = new Map<ConnectorId, HealthConnector>([
  ["google-drive", googleDriveConnector],
  ["hubspot", hubspotConnector],
  ["carta", cartaConnector],
  ["quickbooks", quickbooksConnector],
  ["box", boxConnector],
  ["slack", slackConnector],
]);

/** All registered connector adapters. */
export function getAllConnectors(): HealthConnector[] {
  return [...connectorRegistry.values()];
}

export function getConnector(id: ConnectorId): HealthConnector | undefined {
  return connectorRegistry.get(id);
}

/** Connected connectors only — used for active ingestion. */
export function getActiveConnectors(): HealthConnector[] {
  return getAllConnectors().filter((c) => c.status === "connected");
}

/** Acme Corp uses all connectors including pending Slack (shown in catalog). */
export const acmeConnectors = getAllConnectors();
