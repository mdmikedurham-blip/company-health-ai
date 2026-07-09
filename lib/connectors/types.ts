import type { ConnectorId, Evidence } from "@/lib/domain";

/**
 * Context passed to connectors when collecting evidence for a company.
 * Future OAuth tokens, sync cursors, and tenant config live here.
 */
export interface ConnectorContext {
  companyId: string;
  /** ISO timestamp — only return evidence observed after this point when set. */
  since?: string;
  /** Optional connector-specific options (folder IDs, account IDs, etc.). */
  options?: Record<string, unknown>;
}

/**
 * Connector contract: normalize source-system data into Evidence.
 * Implementations must not compute Findings, Risks, or HealthScores —
 * that is the Insight Engine's job. Swapping or adding connectors
 * (Google Drive, HubSpot, Carta, QuickBooks, Box, …) should not
 * require UI changes.
 */
export interface EvidenceConnector {
  readonly id: ConnectorId;
  readonly displayName: string;
  collect(ctx: ConnectorContext): Promise<Evidence[]>;
}

/** Registry of available connectors for a company / environment. */
export class ConnectorRegistry {
  private readonly connectors = new Map<ConnectorId, EvidenceConnector>();

  register(connector: EvidenceConnector): void {
    this.connectors.set(connector.id, connector);
  }

  get(id: ConnectorId): EvidenceConnector | undefined {
    return this.connectors.get(id);
  }

  list(): EvidenceConnector[] {
    return [...this.connectors.values()];
  }

  async collectAll(ctx: ConnectorContext): Promise<Evidence[]> {
    const batches = await Promise.all(
      this.list().map((connector) => connector.collect(ctx)),
    );
    return batches.flat();
  }
}
