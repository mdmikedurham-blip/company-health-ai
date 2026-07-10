import { describe, expect, it } from "vitest";
import type { Evidence } from "@/lib/domain";
import { createEvidence } from "@/lib/connectors/create-evidence";
import { createMockConnector } from "@/lib/connectors/create-mock-connector";
import {
  ingestFromConnectors,
  runConnectorPipeline,
} from "@/lib/connectors/ingest";
import {
  ingestFromConnectorsSync,
  requireSyncAdapters,
  runConnectorPipelineSync,
} from "@/lib/connectors/ingest-sync";
import { analyzeEvidence } from "@/lib/intelligence/evidence-analyzer";
import { deriveFindings } from "@/lib/intelligence/finding-engine";
import { assessRisks } from "@/lib/intelligence/risk-engine";
import {
  calculateConfidence,
  calculateDimensionScores,
  computeHealthFromFindings,
} from "@/lib/intelligence/scoring-engine";
import {
  computePriorityScore,
  generateRecommendations,
} from "@/lib/intelligence/recommendation-engine";
import { DEFAULT_AS_OF, runInsightEngine } from "@/lib/intelligence";
import {
  BASELINE_DIMENSION_SCORE,
  CONCENTRATION_HIGH,
  CONCENTRATION_MEDIUM,
  CONFIDENCE_EMPTY,
  FINDING_POLICY,
  LOW_ATTRITION_THRESHOLD,
  MFA_COVERAGE_THRESHOLD,
  NRR_RISK_THRESHOLD,
  PRIORITY_HIGH_MIN,
  PRIORITY_MEDIUM_MIN,
  RECURRING_REVENUE_POSITIVE,
  RUNWAY_HIGH_RISK,
  RUNWAY_MEDIUM_RISK,
  RUNWAY_POSITIVE,
  STATUS_HEALTHY_MIN,
  STATUS_WATCH_MIN,
  deriveRiskSeverity,
  deriveStatus,
  priorityFromScore,
} from "@/lib/intelligence/rules";

const AS_OF = new Date(DEFAULT_AS_OF);

function ev(
  overrides: Partial<Parameters<typeof createEvidence>[0]> &
    Pick<Parameters<typeof createEvidence>[0], "id" | "extractedFacts" | "dimensionIds">,
): Evidence {
  return createEvidence({
    sourceSystem: "Test",
    sourceType: "test",
    title: `Evidence ${overrides.id}`,
    contentSummary: "Test evidence",
    occurredAt: "2026-07-01",
    collectedAt: "Today, 6:00 AM",
    reliability: 90,
    ...overrides,
  });
}

describe("customer concentration thresholds", () => {
  it("flags high risk when top-3 ARR share exceeds CONCENTRATION_HIGH", () => {
    const evidence = [
      ev({
        id: "ev-conc-high",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH + 0.08 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    expect(insights[0]?.ruleId).toBe("concentration-high");
    const findings = deriveFindings(insights, evidence);
    expect(findings[0]?.scoreImpact).toBe(
      FINDING_POLICY["concentration-high"].scoreImpact,
    );
    expect(assessRisks(findings, evidence)[0]?.severity).toBe("high");
  });

  it("flags medium risk at CONCENTRATION_MEDIUM inclusive", () => {
    const evidence = [
      ev({
        id: "ev-conc-med",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_MEDIUM },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    expect(insights[0]?.ruleId).toBe("concentration-medium");
    const findings = deriveFindings(insights, evidence);
    expect(findings[0]?.scoreImpact).toBe(
      FINDING_POLICY["concentration-medium"].scoreImpact,
    );
  });

  it("does not flag at exactly CONCENTRATION_HIGH (strict >)", () => {
    const evidence = [
      ev({
        id: "ev-conc-eq",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_HIGH },
      }),
    ];
    // At exactly 50%, medium band applies (>= 35% and not > 50%)
    const insights = analyzeEvidence(evidence);
    expect(insights[0]?.ruleId).toBe("concentration-medium");
  });

  it("does not flag below CONCENTRATION_MEDIUM", () => {
    const evidence = [
      ev({
        id: "ev-conc-low",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: CONCENTRATION_MEDIUM - 0.01 },
      }),
    ];
    expect(analyzeEvidence(evidence)).toHaveLength(0);
  });
});

describe("missing intellectual-property assignment detection", () => {
  it("creates a legal finding and risk when agreements lack IP clauses", () => {
    const evidence = [
      ev({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        sourceSystem: "Box",
        extractedFacts: {
          agreementsMissingIpAssignment: 4,
          totalContractorAgreements: 12,
        },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    expect(result.findings.some((f) => f.id === "finding-ip-gap")).toBe(true);
    expect(result.risks.some((r) => r.id === "risk-ip-gap")).toBe(true);
  });

  it("ignores zero missing IP assignments", () => {
    const evidence = [
      ev({
        id: "ev-ip-ok",
        dimensionIds: ["dim-legal"],
        extractedFacts: { agreementsMissingIpAssignment: 0 },
      }),
    ];
    expect(analyzeEvidence(evidence)).toHaveLength(0);
  });
});

describe("board approval detection", () => {
  it("creates a governance risk when option grants lack board approval", () => {
    const evidence = [
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    expect(result.findings.some((f) => f.id === "finding-board-approval")).toBe(true);
    expect(result.risks.some((r) => r.id === "risk-board-approval")).toBe(true);
  });

  it("fires on materialActionsMissingBoardApproval boolean", () => {
    const evidence = [
      ev({
        id: "ev-board-mat",
        dimensionIds: ["dim-governance"],
        extractedFacts: { materialActionsMissingBoardApproval: true },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("board-approval");
  });
});

describe("cash runway thresholds", () => {
  it("high risk below RUNWAY_HIGH_RISK", () => {
    const evidence = [
      ev({
        id: "ev-run-high",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_HIGH_RISK - 1 },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("runway-high");
    const findings = deriveFindings(analyzeEvidence(evidence), evidence);
    expect(findings[0]?.scoreImpact).toBe(FINDING_POLICY["runway-high"].scoreImpact);
  });

  it("medium risk from RUNWAY_HIGH_RISK inclusive to below RUNWAY_MEDIUM_RISK", () => {
    const evidence = [
      ev({
        id: "ev-run-med",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_HIGH_RISK },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("runway-medium");
  });

  it("positive above RUNWAY_POSITIVE", () => {
    const evidence = [
      ev({
        id: "ev-run-pos",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_POSITIVE + 1 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    expect(insights[0]?.ruleId).toBe("runway-positive");
    const findings = deriveFindings(insights, evidence);
    expect(findings[0]?.direction).toBe("positive");
    expect(assessRisks(findings, evidence)).toHaveLength(0);
  });

  it("no finding between medium and positive bands", () => {
    const evidence = [
      ev({
        id: "ev-run-ok",
        dimensionIds: ["dim-financial"],
        extractedFacts: { cashRunwayMonths: RUNWAY_MEDIUM_RISK + 1 },
      }),
    ];
    expect(analyzeEvidence(evidence)).toHaveLength(0);
  });
});

describe("revenue quality thresholds", () => {
  it("positive finding when recurring revenue exceeds threshold", () => {
    const evidence = [
      ev({
        id: "ev-rec",
        dimensionIds: ["dim-revenue-quality"],
        extractedFacts: { recurringRevenueShare: RECURRING_REVENUE_POSITIVE + 0.05 },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("recurring-revenue");
  });

  it("risk when NRR falls below threshold", () => {
    const evidence = [
      ev({
        id: "ev-nrr",
        dimensionIds: ["dim-revenue-quality"],
        extractedFacts: { netRevenueRetention: NRR_RISK_THRESHOLD - 0.05 },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    expect(result.findings.some((f) => f.id === "finding-nrr")).toBe(true);
    expect(result.risks.some((r) => r.id === "risk-nrr")).toBe(true);
  });
});

describe("security readiness", () => {
  it("flags open critical controls", () => {
    const evidence = [
      ev({
        id: "ev-crit",
        dimensionIds: ["dim-security"],
        extractedFacts: { openCriticalControls: 2 },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("critical-controls");
  });

  it("flags MFA below threshold", () => {
    const evidence = [
      ev({
        id: "ev-mfa",
        dimensionIds: ["dim-security"],
        extractedFacts: { mfaCoverage: MFA_COVERAGE_THRESHOLD - 0.03 },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("mfa");
  });

  it("merges critical controls and MFA into one security finding", () => {
    const evidence = [
      ev({
        id: "ev-sec",
        dimensionIds: ["dim-security"],
        extractedFacts: { openCriticalControls: 1, mfaCoverage: 0.9 },
      }),
    ];
    const findings = deriveFindings(analyzeEvidence(evidence), evidence);
    expect(findings.filter((f) => f.id === "finding-security-readiness")).toHaveLength(1);
  });
});

describe("people health", () => {
  it("positive finding for low voluntary attrition at threshold", () => {
    const evidence = [
      ev({
        id: "ev-attr",
        dimensionIds: ["dim-people"],
        extractedFacts: { voluntaryAttritionRate: LOW_ATTRITION_THRESHOLD },
      }),
    ];
    expect(analyzeEvidence(evidence)[0]?.ruleId).toBe("low-attrition");
  });

  it("key-person risk for single-owner critical functions", () => {
    const evidence = [
      ev({
        id: "ev-kp",
        dimensionIds: ["dim-people"],
        extractedFacts: { singleOwnerCriticalFunctions: ["Payments"] },
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    expect(result.risks.some((r) => r.id === "risk-key-person")).toBe(true);
  });
});

describe("score calculation", () => {
  it("starts dimensions at BASELINE and applies finding impacts", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.6 },
      }),
    ];
    const insights = analyzeEvidence(evidence);
    const findings = deriveFindings(insights, evidence);
    const { dimensions } = calculateDimensionScores(
      findings,
      evidence,
      ["dim-customer"],
      AS_OF,
    );
    const customer = dimensions.find((d) => d.id === "dim-customer")!;
    expect(customer.score).toBe(
      BASELINE_DIMENSION_SCORE + FINDING_POLICY["concentration-high"].scoreImpact,
    );
  });

  it("clamps scores to 0–100", () => {
    const evidence = [
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 5 },
      }),
    ];
    const { healthScore, dimensions } = computeHealthFromFindings(
      deriveFindings(analyzeEvidence(evidence), evidence),
      evidence,
      undefined,
      undefined,
      AS_OF,
    );
    expect(healthScore.score).toBeGreaterThanOrEqual(0);
    expect(healthScore.score).toBeLessThanOrEqual(100);
    for (const d of dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("deriveStatus uses STATUS_HEALTHY_MIN and STATUS_WATCH_MIN", () => {
    expect(deriveStatus(STATUS_HEALTHY_MIN)).toBe("healthy");
    expect(deriveStatus(STATUS_HEALTHY_MIN - 1)).toBe("watch");
    expect(deriveStatus(STATUS_WATCH_MIN)).toBe("watch");
    expect(deriveStatus(STATUS_WATCH_MIN - 1)).toBe("at-risk");
  });
});

describe("confidence calculation", () => {
  it("returns CONFIDENCE_EMPTY when evidence is missing", () => {
    expect(calculateConfidence([], AS_OF)).toBe(CONFIDENCE_EMPTY);
  });

  it("increases confidence with fresh, reliable evidence", () => {
    const rich = Array.from({ length: 8 }, (_, i) =>
      ev({
        id: `e${i}`,
        dimensionIds: ["dim-financial"],
        extractedFacts: {},
        reliability: 95,
        collectedAt: "Today, 6:00 AM",
      }),
    );
    const sparse = [
      ev({
        id: "old",
        dimensionIds: ["dim-financial"],
        extractedFacts: {},
        reliability: 60,
        collectedAt: "2024-01-01",
      }),
    ];
    expect(calculateConfidence(rich, AS_OF)).toBeGreaterThan(
      calculateConfidence(sparse, AS_OF),
    );
  });

  it("is stable for the same asOf across calls", () => {
    const evidence = [
      ev({
        id: "iso",
        dimensionIds: ["dim-financial"],
        extractedFacts: {},
        reliability: 90,
        collectedAt: "2026-06-01T00:00:00.000Z",
      }),
    ];
    expect(calculateConfidence(evidence, AS_OF)).toBe(
      calculateConfidence(evidence, AS_OF),
    );
  });
});

describe("determinism", () => {
  it("same evidence + same asOf produces identical engine output", () => {
    const evidence = [
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.58 },
        reliability: 94,
        collectedAt: "2026-07-01T00:00:00.000Z",
      }),
      ev({
        id: "ev-board",
        dimensionIds: ["dim-governance"],
        extractedFacts: { optionGrantsMissingBoardApproval: 3 },
        reliability: 97,
        collectedAt: "2026-06-20T00:00:00.000Z",
      }),
    ];
    const input = {
      companyId: "c1",
      evidence,
      asOf: DEFAULT_AS_OF,
    };
    const a = runInsightEngine(input);
    const b = runInsightEngine(input);
    expect(a.healthScore).toEqual(b.healthScore);
    expect(a.findings).toEqual(b.findings);
    expect(a.risks).toEqual(b.risks);
    expect(a.recommendations).toEqual(b.recommendations);
    expect(a.timelineEvents).toEqual(b.timelineEvents);
    expect(a.scoreChange).toEqual(b.scoreChange);
    expect(a.dimensions.map((d) => ({ id: d.id, score: d.score, confidence: d.confidence }))).toEqual(
      b.dimensions.map((d) => ({ id: d.id, score: d.score, confidence: d.confidence })),
    );
  });
});

describe("recommendation ranking", () => {
  it("computes priorityScore from improvement × severity × confidence ÷ effort", () => {
    const high = computePriorityScore({
      estimatedScoreImprovement: 8,
      severity: "high",
      confidence: 90,
      effort: "low",
    });
    const low = computePriorityScore({
      estimatedScoreImprovement: 8,
      severity: "low",
      confidence: 90,
      effort: "high",
    });
    expect(high).toBeGreaterThan(low);
  });

  it("maps priority bands from PRIORITY_HIGH_MIN / PRIORITY_MEDIUM_MIN", () => {
    expect(priorityFromScore(PRIORITY_HIGH_MIN)).toBe("high");
    expect(priorityFromScore(PRIORITY_HIGH_MIN - 0.01)).toBe("medium");
    expect(priorityFromScore(PRIORITY_MEDIUM_MIN)).toBe("medium");
    expect(priorityFromScore(PRIORITY_MEDIUM_MIN - 0.01)).toBe("low");
  });

  it("returns recommendations sorted by priorityScore descending", () => {
    const evidence = [
      ev({
        id: "ev-ip",
        dimensionIds: ["dim-legal"],
        extractedFacts: { agreementsMissingIpAssignment: 2 },
        reliability: 91,
      }),
      ev({
        id: "ev-conc",
        dimensionIds: ["dim-customer"],
        extractedFacts: { top3CustomerArrShare: 0.55 },
        reliability: 94,
      }),
    ];
    const result = runInsightEngine({ companyId: "c1", evidence });
    const scores = result.recommendations.map((r) => r.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const regenerated = generateRecommendations(result.risks, result.findings);
    expect(regenerated.map((r) => r.priorityScore)).toEqual(
      [...regenerated.map((r) => r.priorityScore)].sort((a, b) => b - a),
    );
  });
});

describe("risk severity derivation", () => {
  it("uses materiality and scoreImpact policy cutoffs", () => {
    expect(deriveRiskSeverity(9, -4)).toBe("high");
    expect(deriveRiskSeverity(6, -4)).toBe("medium");
    expect(deriveRiskSeverity(3, -2)).toBe("low");
    expect(deriveRiskSeverity(5, -12)).toBe("high");
  });
});

describe("empty evidence through full engine", () => {
  it("returns baseline scores with reduced confidence and no invented risks", () => {
    const result = runInsightEngine({ companyId: "c1", evidence: [] });
    expect(result.findings).toHaveLength(0);
    expect(result.risks).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
    expect(result.healthScore.confidence).toBe(CONFIDENCE_EMPTY);
    expect(result.dimensions.every((d) => d.score === BASELINE_DIMENSION_SCORE)).toBe(
      true,
    );
  });
});

describe("connector normalization (ConnectorAdapter)", () => {
  it("createEvidence produces canonical Evidence without UI alias fields", () => {
    const item = createEvidence({
      id: "ev-x",
      sourceSystem: "HubSpot",
      sourceType: "report",
      title: "Test doc",
      contentSummary: "Summary",
      extractedFacts: { top3CustomerArrShare: 0.4 },
      dimensionIds: ["dim-customer"],
      occurredAt: "2026-07-01",
      collectedAt: "Today",
      reliability: 88,
    });
    expect(item.title).toBe("Test doc");
    expect(item.reliability).toBe(88);
    expect(item.contentSummary).toBe("Summary");
    expect(item.dimension).toBe("Customer");
    expect(
      (item as { documentName?: string }).documentName,
    ).toBeUndefined();
  });

  it("collect() + normalize(raw) rebuilds Evidence from metadata (no hidden Evidence object)", async () => {
    const evidence = createEvidence({
      id: "ev-norm",
      sourceSystem: "Box",
      sourceType: "audit",
      title: "Legal audit",
      contentSummary: "IP gaps",
      extractedFacts: { agreementsMissingIpAssignment: 1 },
      dimensionIds: ["dim-legal"],
      occurredAt: "2026-06-01",
      collectedAt: "Today",
      reliability: 90,
    });
    const connector = createMockConnector({
      id: "box",
      name: "Box",
      system: "Box",
      status: "connected",
      lastSynced: "now",
      documentsAnalyzed: 1,
      mappings: [{ externalId: "ext-1", evidence }],
    });
    expect(connector.connectorId).toBe("box");
    const raw = await connector.collect();
    expect(raw.items).toHaveLength(1);
    expect(raw.items[0]?.metadata?.evidenceId).toBe("ev-norm");
    expect(
      (raw.items[0] as { evidence?: unknown }).evidence,
    ).toBeUndefined();
    const normalized = await connector.normalize(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.id).toBe("ev-norm");
    expect(normalized[0]?.extractedFacts.agreementsMissingIpAssignment).toBe(1);
    expect(normalized[0]?.title).toBe("Legal audit");
  });

  it("normalize returns [] for pending connectors", async () => {
    const pending = createMockConnector({
      id: "slack",
      name: "Slack",
      system: "Slack",
      status: "pending",
      lastSynced: "n/a",
      documentsAnalyzed: 0,
      mappings: [],
    });
    const connected = createMockConnector({
      id: "hubspot",
      name: "HubSpot",
      system: "HubSpot",
      status: "connected",
      lastSynced: "now",
      documentsAnalyzed: 10,
      mappings: [
        {
          externalId: "h1",
          evidence: createEvidence({
            id: "ev-h1",
            sourceSystem: "HubSpot",
            sourceType: "report",
            title: "ARR",
            contentSummary: "conc",
            extractedFacts: { top3CustomerArrShare: 0.6 },
            dimensionIds: ["dim-customer"],
            occurredAt: "2026-07-01",
            collectedAt: "Today",
            reliability: 94,
          }),
        },
      ],
    });
    const { evidence } = await ingestFromConnectors([pending, connected]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.id).toBe("ev-h1");

    const syncResult = ingestFromConnectorsSync([pending, connected]);
    expect(syncResult.evidence).toHaveLength(1);
  });

  it("runConnectorPipeline feeds runInsightEngine end-to-end", async () => {
    const connector = createMockConnector({
      id: "carta",
      name: "Carta",
      system: "Carta",
      status: "connected",
      lastSynced: "now",
      documentsAnalyzed: 5,
      mappings: [
        {
          externalId: "c1",
          evidence: createEvidence({
            id: "ev-c1",
            sourceSystem: "Carta",
            sourceType: "equity",
            title: "Grants",
            contentSummary: "missing approvals",
            extractedFacts: { optionGrantsMissingBoardApproval: 2 },
            dimensionIds: ["dim-governance"],
            occurredAt: "2026-06-01",
            collectedAt: "Today",
            reliability: 97,
          }),
        },
      ],
    });
    const { evidence, evidenceCatalog } = await runConnectorPipeline({
      connectors: [connector],
      lastFullScan: "Today",
    });
    expect(evidenceCatalog.systemsConnected).toBe(1);
    const result = runInsightEngine({ companyId: "c1", evidence });
    expect(result.risks.some((r) => r.id === "risk-board-approval")).toBe(true);
  });
});

describe("full Acme connector corpus", () => {
  it("runs registered Acme connectors through the engine", async () => {
    const { acmeConnectors } = await import("@/lib/connectors");
    const syncAdapters = requireSyncAdapters(acmeConnectors);
    const { evidence } = runConnectorPipelineSync({
      connectors: syncAdapters,
      lastFullScan: "Today, 5:00 AM",
    });
    expect(evidence.length).toBeGreaterThanOrEqual(10);
    expect(evidence.some((e) => e.id === "ev-people-health")).toBe(true);

    const asyncPipeline = await runConnectorPipeline({
      connectors: acmeConnectors,
      lastFullScan: "Today, 5:00 AM",
    });
    expect(asyncPipeline.evidence.length).toBe(evidence.length);

    const result = runInsightEngine({ companyId: "company-acme", evidence });
    expect(result.findings.some((f) => f.id === "finding-concentration")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-ip-gap")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-board-approval")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-security-readiness")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-low-attrition")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-key-person")).toBe(true);
    expect(result.findings.some((f) => f.id === "finding-recurring-revenue")).toBe(true);
    expect(result.recommendations.length).toBe(result.risks.length);
  });
});

describe("multi-company snapshot accessor", () => {
  it("getCompanyHealthSnapshot returns Acme by companyId", async () => {
    const {
      getCompanyHealthSnapshot,
      listRegisteredCompanyIds,
      invalidateCompanySnapshot,
    } = await import("@/lib/data");
    expect(listRegisteredCompanyIds()).toContain("company-acme");
    const snap = getCompanyHealthSnapshot("company-acme");
    expect(snap.company.id).toBe("company-acme");
    expect(snap.healthScore.score).toBeGreaterThan(0);
    expect(snap.executiveBrief.highlights.length).toBeGreaterThan(0);
    expect(snap.executiveBrief.summary).toBe(snap.scoreChange.summary);
    invalidateCompanySnapshot("company-acme");
    const rebuilt = getCompanyHealthSnapshot("company-acme");
    expect(rebuilt.healthScore.score).toBe(snap.healthScore.score);
  });
});
