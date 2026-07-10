import { bambooHrConnector } from "./bamboohr";
import { boxConnector } from "./box";
import { cartaConnector } from "./carta";
import type { ConnectorAdapter, ConnectorId } from "./connector";
import { googleDriveConnector } from "./google-drive";
import { hubspotConnector } from "./hubspot";
import { quickbooksConnector } from "./quickbooks";
import { slackConnector } from "./slack";

const connectorRegistry = new Map<ConnectorId, ConnectorAdapter>([
  ["google-drive", googleDriveConnector],
  ["hubspot", hubspotConnector],
  ["carta", cartaConnector],
  ["quickbooks", quickbooksConnector],
  ["box", boxConnector],
  ["bamboohr", bambooHrConnector],
  ["slack", slackConnector],
]);

/** All registered connector adapters. */
export function getAllConnectors(): ConnectorAdapter[] {
  return [...connectorRegistry.values()];
}

export function getConnector(id: ConnectorId): ConnectorAdapter | undefined {
  return connectorRegistry.get(id);
}

/** Connected connectors only — used for active ingestion. */
export function getActiveConnectors(): ConnectorAdapter[] {
  return getAllConnectors().filter((c) => c.status === "connected");
}

/** Register an additional connector at runtime (tests / future plugins). */
export function registerConnector(connector: ConnectorAdapter): void {
  connectorRegistry.set(connector.connectorId, connector);
}

/** Default Acme Corp connector set including pending Slack. */
export const acmeConnectors = getAllConnectors();
