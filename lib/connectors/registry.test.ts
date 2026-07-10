import { describe, expect, it } from "vitest";
import { createMockConnector } from "./create-mock-connector";
import { ConnectorRegistry } from "./registry";

describe("ConnectorRegistry", () => {
  it("dynamically registers and retrieves connectors", () => {
    const registry = new ConnectorRegistry();
    const hubspot = createMockConnector({
      id: "hubspot",
      name: "HubSpot",
      system: "HubSpot",
      status: "connected",
      documentsAnalyzed: 0,
      lastSynced: "Never",
      mappings: [],
    });
    const dropbox = createMockConnector({
      id: "dropbox",
      name: "Dropbox",
      system: "Dropbox",
      status: "pending",
      documentsAnalyzed: 0,
      lastSynced: "Never",
      mappings: [],
    });

    registry.register(hubspot);
    registry.register(dropbox);

    expect(registry.has("hubspot")).toBe(true);
    expect(registry.get("dropbox")?.name).toBe("Dropbox");
    expect(registry.getActive().map((c) => c.connectorId)).toEqual(["hubspot"]);
    expect(registry.listIds().sort()).toEqual(["dropbox", "hubspot"]);

    registry.unregister("hubspot");
    expect(registry.has("hubspot")).toBe(false);
  });
});
