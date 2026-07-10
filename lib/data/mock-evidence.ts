/**
 * Mock evidence corpus for Acme Corp — Phase 2 Insight Engine input.
 * Facts are structured so rules fire deterministically; an LLM can populate
 * the same extractedFacts shape later without UI or domain changes.
 */

import type { Evidence, ExtractedFacts } from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/intelligence/rules";

function evidence(params: {
  id: string;
  sourceSystem: string;
  sourceType: string;
  title: string;
  contentSummary: string;
  extractedFacts: ExtractedFacts;
  dimensionIds: string[];
  occurredAt: string;
  collectedAt: string;
  reliability: number;
  metadata?: Evidence["metadata"];
  citation?: Partial<Evidence["citation"]>;
}): Evidence {
  const dimensionId = params.dimensionIds[0]!;
  return {
    id: params.id,
    sourceSystem: params.sourceSystem,
    sourceType: params.sourceType,
    title: params.title,
    contentSummary: params.contentSummary,
    extractedFacts: params.extractedFacts,
    dimensionIds: params.dimensionIds,
    dimensionId,
    dimension: DIMENSION_NAMES[dimensionId] ?? dimensionId,
    occurredAt: params.occurredAt,
    collectedAt: params.collectedAt,
    reliability: params.reliability,
    metadata: params.metadata ?? {},
    citation: {
      label: `${params.sourceSystem} · ${params.title}`,
      ...params.citation,
    },
    // UI adapter aliases
    documentName: params.title,
    confidence: params.reliability,
    lastReviewed: params.collectedAt,
    summary: params.contentSummary,
    findingIds: [],
    linkedRiskIds: [],
  };
}

export const mockEvidence: Evidence[] = [
  evidence({
    id: "ev-arr-cohort",
    sourceSystem: "HubSpot",
    sourceType: "report",
    title: "ARR cohort analysis",
    contentSummary:
      "Top 3 customers account for 58% of ARR ($4.2M of $7.2M). Meridian Corp alone represents 24%.",
    extractedFacts: {
      top3CustomerArrShare: 0.58,
      topCustomerArrShare: 0.24,
      topCustomerName: "Meridian Corp",
      totalArr: 7_200_000,
    },
    dimensionIds: ["dim-customer", "dim-revenue-quality"],
    occurredAt: "2026-07-01",
    collectedAt: "Today, 6:32 AM",
    reliability: 94,
  }),

  evidence({
    id: "ev-legal-audit",
    sourceSystem: "Box",
    sourceType: "audit",
    title: "Legal folder audit",
    contentSummary:
      "4 of 12 active contractor agreements lack signed IP assignment clauses (C-104, C-108, C-111, C-115).",
    extractedFacts: {
      agreementsMissingIpAssignment: 4,
      totalContractorAgreements: 12,
      missingAgreementIds: ["C-104", "C-108", "C-111", "C-115"],
    },
    dimensionIds: ["dim-legal"],
    occurredAt: "2026-06-15",
    collectedAt: "Today, 6:28 AM",
    reliability: 91,
  }),

  evidence({
    id: "ev-equity-grants",
    sourceSystem: "Carta",
    sourceType: "equity",
    title: "Equity grant review",
    contentSummary:
      "3 option grants from Q2 2024 lack documented board consent in Carta.",
    extractedFacts: {
      optionGrantsMissingBoardApproval: 3,
      materialActionsMissingBoardApproval: false,
      grantPeriods: ["Q2 2024"],
    },
    dimensionIds: ["dim-governance"],
    occurredAt: "2026-06-20",
    collectedAt: "Today, 6:10 AM",
    reliability: 97,
  }),

  evidence({
    id: "ev-cash-runway",
    sourceSystem: "QuickBooks",
    sourceType: "financial",
    title: "Cash runway forecast",
    contentSummary:
      "Cash position $3.4M. Burn implies 14.2 months runway at current spend.",
    extractedFacts: {
      cashRunwayMonths: 14.2,
      cashBalance: 3_400_000,
    },
    dimensionIds: ["dim-financial"],
    occurredAt: "2026-07-05",
    collectedAt: "Today, 6:15 AM",
    reliability: 98,
  }),

  evidence({
    id: "ev-revenue-quality",
    sourceSystem: "HubSpot",
    sourceType: "report",
    title: "Revenue quality dashboard",
    contentSummary:
      "88% recurring revenue. Net revenue retention at 108%. Mid-market expansion improving cohort retention.",
    extractedFacts: {
      recurringRevenueShare: 0.88,
      netRevenueRetention: 1.08,
    },
    dimensionIds: ["dim-revenue-quality"],
    occurredAt: "2026-07-01",
    collectedAt: "Today, 6:20 AM",
    reliability: 93,
  }),

  evidence({
    id: "ev-soc2-review",
    sourceSystem: "Google Drive",
    sourceType: "security",
    title: "SOC 2 control review",
    contentSummary:
      "Internal review passed 42 Type I controls. 3 critical observation windows remain open. MFA coverage at 92%.",
    extractedFacts: {
      openCriticalControls: 3,
      mfaCoverage: 0.92,
      controlsPassed: 42,
    },
    dimensionIds: ["dim-security"],
    occurredAt: "2026-07-03",
    collectedAt: "Yesterday, 4:00 PM",
    reliability: 92,
  }),

  evidence({
    id: "ev-people-health",
    sourceSystem: "BambooHR",
    sourceType: "hr",
    title: "Q2 people health report",
    contentSummary:
      "Zero voluntary attrition in Q2. Infrastructure and payments on-call owned by a single engineer.",
    extractedFacts: {
      voluntaryAttritionRate: 0,
      singleOwnerCriticalFunctions: ["Infrastructure on-call", "Payments reconciliation"],
      headcount: 84,
    },
    dimensionIds: ["dim-people"],
    occurredAt: "2026-06-30",
    collectedAt: "Jul 2, 2026",
    reliability: 90,
  }),

  evidence({
    id: "ev-board-minutes",
    sourceSystem: "Google Drive",
    sourceType: "board",
    title: "Board minutes — May 2026",
    contentSummary:
      "Board approved Q2 forecast and mid-market expansion pilot. Governance cleanup report due July 15.",
    extractedFacts: {
      boardMeetingDate: "2026-05-22",
      approvedItems: ["Q2 forecast", "Mid-market expansion pilot"],
    },
    dimensionIds: ["dim-governance"],
    occurredAt: "2026-05-22",
    collectedAt: "Today, 6:30 AM",
    reliability: 89,
  }),

  evidence({
    id: "ev-product-roadmap",
    sourceSystem: "Google Drive",
    sourceType: "product",
    title: "Product roadmap Q3-Q4",
    contentSummary:
      "Q3 roadmap on track with 3 major features shipping on schedule. AI copilot beta launching August.",
    extractedFacts: {
      featuresOnTrack: 3,
      aiCopilotBetaDate: "2026-08-01",
    },
    dimensionIds: ["dim-product"],
    occurredAt: "2026-07-01",
    collectedAt: "Yesterday, 2:15 PM",
    reliability: 85,
  }),

  evidence({
    id: "ev-ai-readiness",
    sourceSystem: "Google Drive",
    sourceType: "assessment",
    title: "AI readiness assessment",
    contentSummary:
      "Data infrastructure ready. Model governance policies drafted but awaiting board approval.",
    extractedFacts: {
      dataInfrastructureReady: true,
      modelGovernanceApproved: false,
    },
    dimensionIds: ["dim-ai-readiness"],
    occurredAt: "2026-07-05",
    collectedAt: "Jul 5, 2026",
    reliability: 78,
  }),
];

/** Evidence catalog metadata derived from the mock corpus + connector counts. */
export const mockEvidenceCatalogMeta = {
  lastFullScan: "Today, 5:00 AM",
  connectors: [
    { id: "hubspot", name: "HubSpot", system: "HubSpot", documentsAnalyzed: 605, lastSynced: "6:32 AM" },
    { id: "box", name: "Box", system: "Box", documentsAnalyzed: 189, lastSynced: "6:28 AM" },
    { id: "carta", name: "Carta", system: "Carta", documentsAnalyzed: 47, lastSynced: "6:10 AM" },
    { id: "quickbooks", name: "QuickBooks", system: "QuickBooks", documentsAnalyzed: 94, lastSynced: "6:15 AM" },
    { id: "google-drive", name: "Google Drive", system: "Google Drive", documentsAnalyzed: 312, lastSynced: "6:30 AM" },
    { id: "bamboohr", name: "BambooHR", system: "BambooHR", documentsAnalyzed: 45, lastSynced: "Jul 2" },
  ],
};
