import { describe, expect, it } from "vitest";
import {
  countConnectedSystems,
  connectedSystemsFromCatalog,
} from "@/lib/connectors/ingest";
import { requireSyncAdapters, runConnectorPipelineSync } from "@/lib/connectors/ingest-sync";
import { acmeConnectors } from "@/lib/connectors";
import { DEFAULT_AS_OF, runInsightEngine } from "@/lib/intelligence";
import { asRatio, formatPercent } from "@/lib/intelligence/rules";
import {
  getCompanyHealthSnapshot,
  invalidateCompanySnapshot,
} from "@/lib/data";

describe("cross-view data integrity", () => {
  it("uses one connected-system count across catalog and DNA", async () => {
    invalidateCompanySnapshot("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");

    const connectedFromCatalog = countConnectedSystems(snap.evidenceCatalog.connectors);
    expect(snap.evidenceCatalog.systemsConnected).toBe(connectedFromCatalog);
    expect(snap.dna.keySystems.filter((s) => s.status === "connected").length).toBe(
      connectedFromCatalog,
    );
    expect(connectedSystemsFromCatalog(snap.evidenceCatalog)).toEqual(
      snap.dna.keySystems,
    );
    // Acme: 6 connected + Slack pending
    expect(connectedFromCatalog).toBe(6);
    expect(snap.dna.keySystems.some((s) => s.name === "Slack")).toBe(true);
  });

  it("keeps health, brief, and score-change period deltas aligned", () => {
    invalidateCompanySnapshot("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");

    expect(snap.scoreChange.change).toBe(snap.healthScore.change);
    expect(snap.executiveBrief.scoreChange.change).toBe(snap.healthScore.change);
    expect(snap.executiveBrief.scoreChange.currentScore).toBe(snap.healthScore.score);
    expect(snap.executiveBrief.scoreChange.previousScore).toBe(
      snap.scoreChange.previousScore,
    );

    for (const driver of snap.scoreChange.drivers) {
      expect(typeof driver.currentScoreImpact).toBe("number");
      expect(typeof driver.periodDelta).toBe("number");
      // Without prior dimension scores, periodDelta must not mirror baseline deductions
      expect(driver.periodDelta).toBe(0);
    }
  });

  it("does not invent an NRR risk from HubSpot 1.08 ratio", () => {
    invalidateCompanySnapshot("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");
    const nrrEvidence = snap.evidence.find((e) => e.id === "ev-revenue-quality");
    expect(nrrEvidence?.extractedFacts.netRevenueRetention).toBe(1.08);
    expect(asRatio(1.08)).toBe(1.08);
    expect(formatPercent(asRatio(1.08)!)).toBe("108%");
    expect(snap.findings.some((f) => f.id === "finding-nrr")).toBe(false);
    expect(snap.risks.some((r) => r.id === "risk-nrr")).toBe(false);
    expect(snap.insights.some((i) => i.ruleId === "nrr")).toBe(false);
  });

  it("board-prep details cite per-item evidence, not a shared pool", () => {
    invalidateCompanySnapshot("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");
    const items = snap.executiveBrief.boardImplications;
    expect(items.length).toBeGreaterThan(1);

    const linked = items.filter((i) => i.evidenceIds.length > 0);
    expect(linked.length).toBeGreaterThan(1);

    for (const item of linked) {
      expect(item.detail).not.toMatch(/Board item linked to period drivers/);
      for (const eid of item.evidenceIds) {
        expect(snap.evidence.some((e) => e.id === eid)).toBe(true);
      }
    }

    // Distinct linked items should not all share the identical evidence set
    const signatures = linked.map((i) => [...i.evidenceIds].sort().join("|"));
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it("dashboard metrics documents match evidence catalog totals", () => {
    invalidateCompanySnapshot("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");
    const syncAdapters = requireSyncAdapters(acmeConnectors);
    const { evidenceCatalog } = runConnectorPipelineSync({
      connectors: syncAdapters,
      lastFullScan: "Today, 5:00 AM",
    });
    expect(snap.evidenceCatalog.systemsConnected).toBe(
      evidenceCatalog.systemsConnected,
    );
    expect(snap.evidenceCatalog.totalDocuments).toBe(evidenceCatalog.totalDocuments);

    const engine = runInsightEngine({
      companyId: "company-acme",
      evidence: snap.evidence,
      asOf: DEFAULT_AS_OF,
    });
    expect(engine.healthScore.score).toBe(snap.healthScore.score);
    expect(engine.findings.map((f) => f.id).sort()).toEqual(
      snap.findings.map((f) => f.id).sort(),
    );
  });
});
