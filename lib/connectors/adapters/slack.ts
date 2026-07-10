import { createMockConnector } from "../create-mock-connector";

/** Slack is registered but not yet connected — demonstrates pending connector handling. */
export const slackConnector = createMockConnector({
  id: "slack",
  name: "Slack",
  system: "Slack",
  status: "pending",
  lastSynced: "Not connected",
  documentsAnalyzed: 0,
  mappings: [],
});
