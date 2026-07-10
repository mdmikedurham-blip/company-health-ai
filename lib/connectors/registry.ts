import { bambooHrConnector } from "./bamboohr";
import { boxConnector } from "./box";
import { cartaConnector } from "./carta";
import type { ConnectorAdapter, ConnectorId } from "./connector";
import { googleDriveConnector } from "./google-drive";
import { hubspotConnector } from "./hubspot";
import { quickbooksConnector } from "./quickbooks";
import { slackConnector } from "./slack";

/**
 * Dynamic connector registry — register any ConnectorAdapter at runtime.
 * Future HubSpot / Carta / Box / QuickBooks / Slack / Salesforce / Dropbox
 * production adapters plug in here without UI or engine changes.
 */
export class ConnectorRegistry {
  private readonly adapters = new Map<ConnectorId, ConnectorAdapter>();

  constructor(initial?: Iterable<ConnectorAdapter>) {
    if (initial) {
      for (const adapter of initial) {
        this.register(adapter);
      }
    }
  }

  register(connector: ConnectorAdapter): void {
    this.adapters.set(connector.connectorId, connector);
  }

  unregister(id: ConnectorId): boolean {
    return this.adapters.delete(id);
  }

  get(id: ConnectorId): ConnectorAdapter | undefined {
    return this.adapters.get(id);
  }

  has(id: ConnectorId): boolean {
    return this.adapters.has(id);
  }

  getAll(): ConnectorAdapter[] {
    return [...this.adapters.values()];
  }

  getActive(): ConnectorAdapter[] {
    return this.getAll().filter((c) => c.status === "connected");
  }

  listIds(): ConnectorId[] {
    return [...this.adapters.keys()];
  }

  clear(): void {
    this.adapters.clear();
  }
}

/** Process-wide default registry (demo + production adapters). */
export const defaultConnectorRegistry = new ConnectorRegistry([
  googleDriveConnector,
  hubspotConnector,
  cartaConnector,
  quickbooksConnector,
  boxConnector,
  bambooHrConnector,
  slackConnector,
]);

/** All registered connector adapters. */
export function getAllConnectors(): ConnectorAdapter[] {
  return defaultConnectorRegistry.getAll();
}

export function getConnector(id: ConnectorId): ConnectorAdapter | undefined {
  return defaultConnectorRegistry.get(id);
}

/** Connected connectors only — used for active ingestion. */
export function getActiveConnectors(): ConnectorAdapter[] {
  return defaultConnectorRegistry.getActive();
}

/** Register an additional connector at runtime (tests / future plugins). */
export function registerConnector(connector: ConnectorAdapter): void {
  defaultConnectorRegistry.register(connector);
}

/** Default Acme Corp connector set including pending Slack. */
export const acmeConnectors = getAllConnectors();
