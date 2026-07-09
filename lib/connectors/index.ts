import { ConnectorRegistry } from "@/lib/connectors/types";
import { DEFAULT_CONNECTORS } from "@/lib/connectors/fixtures";

export type { ConnectorContext, EvidenceConnector } from "@/lib/connectors/types";
export { ConnectorRegistry } from "@/lib/connectors/types";
export { DEFAULT_CONNECTORS } from "@/lib/connectors/fixtures";
export { FIXTURE_EVIDENCE } from "@/lib/connectors/fixtures/evidence";

/** Build a registry preloaded with the default (fixture) connectors. */
export function createDefaultConnectorRegistry(): ConnectorRegistry {
  const registry = new ConnectorRegistry();
  for (const connector of DEFAULT_CONNECTORS) {
    registry.register(connector);
  }
  return registry;
}
