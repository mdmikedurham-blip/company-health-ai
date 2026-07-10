import type { InsightEngineRules } from "@/lib/engine";

/**
 * Acme Corp extraction and synthesis rules.
 * Simulates what a production NLP/rules layer would produce per connector document.
 */
export const acmeInsightRules: InsightEngineRules = {
  findingExtractions: [
    {
      evidenceId: "ev-arr-cohort",
      finding: {
        id: "finding-concentration",
        title: "Revenue concentration above 50% threshold",
        summary: "Top 3 customers account for 58% of ARR ($4.2M of $7.2M).",
        dimensionId: "dim-customer",
        dimension: "Customer",
        confidence: 94,
        extractedAt: "Today, 6:32 AM",
        sourceSystem: "HubSpot",
      },
    },
    {
      evidenceId: "ev-legal-audit",
      finding: {
        id: "finding-ip-gap",
        title: "IP assignment gap in contractor agreements",
        summary: "4 of 12 active contractor agreements lack signed IP assignment clauses.",
        dimensionId: "dim-legal",
        dimension: "Legal",
        confidence: 91,
        extractedAt: "Today, 6:28 AM",
        sourceSystem: "Box",
      },
    },
    {
      evidenceId: "ev-equity-grants",
      finding: {
        id: "finding-consent-gap",
        title: "Missing board consent on option grants",
        summary: "3 option grants from Q2 2024 lack documented board consent in Carta.",
        dimensionId: "dim-governance",
        dimension: "Governance",
        confidence: 97,
        extractedAt: "Today, 6:10 AM",
        sourceSystem: "Carta",
      },
    },
    {
      evidenceId: "ev-revenue-recon",
      finding: {
        id: "finding-q2-close",
        title: "Q2 close completed 3 days early",
        summary: "Revenue reconciliation variance under 0.3% vs. HubSpot closed-won.",
        dimensionId: "dim-financial",
        dimension: "Financial",
        confidence: 98,
        extractedAt: "Today, 6:15 AM",
        sourceSystem: "QuickBooks",
      },
    },
    {
      evidenceId: "ev-board-minutes",
      finding: {
        id: "finding-board-action",
        title: "Governance cleanup report due July 15",
        summary: "Board minutes require governance cleanup status before Q3 meeting.",
        dimensionId: "dim-governance",
        dimension: "Governance",
        confidence: 89,
        extractedAt: "Today, 6:30 AM",
        sourceSystem: "Google Drive",
      },
    },
    {
      evidenceId: "ev-soc2-review",
      finding: {
        id: "finding-soc2-pass",
        title: "SOC 2 controls passed internal review",
        summary: "All 42 Type I controls passed. Observation period on track for August.",
        dimensionId: "dim-security",
        dimension: "Security",
        confidence: 92,
        extractedAt: "Yesterday, 4:00 PM",
        sourceSystem: "Google Drive",
      },
    },
    {
      evidenceId: "ev-product-roadmap",
      finding: {
        id: "finding-product-velocity",
        title: "Product velocity above benchmark",
        summary: "Q3 roadmap on track with 3 major features shipping on schedule.",
        dimensionId: "dim-product",
        dimension: "Product",
        confidence: 85,
        extractedAt: "Yesterday, 2:15 PM",
        sourceSystem: "Google Drive",
      },
    },
    {
      evidenceId: "ev-ai-readiness",
      finding: {
        id: "finding-ai-governance",
        title: "AI governance policies pending approval",
        summary: "Data infrastructure ready but model governance policies await board sign-off.",
        dimensionId: "dim-ai-readiness",
        dimension: "AI Readiness",
        confidence: 78,
        extractedAt: "Jul 5, 2026",
        sourceSystem: "Google Drive",
      },
    },
  ],

  insightRules: [
    {
      findingIds: ["finding-consent-gap", "finding-board-action"],
      insight: {
        id: "insight-governance",
        title: "Governance trending down",
        detail:
          "Score dropped 2 pts this month. Missing board consents are the primary driver—resolve before July 22 meeting.",
        dimensionId: "dim-governance",
        dimension: "Governance",
        confidence: 93,
        generatedAt: "12 min ago",
        type: "alert",
      },
    },
    {
      findingIds: ["finding-concentration"],
      insight: {
        id: "insight-concentration",
        title: "Customer concentration alert",
        detail: "Top-3 ARR share rose from 54% to 58% in Q2. Meridian Corp renewal is in 90 days.",
        dimensionId: "dim-customer",
        dimension: "Customer",
        confidence: 94,
        generatedAt: "28 min ago",
        type: "alert",
      },
    },
    {
      findingIds: ["finding-q2-close"],
      insight: {
        id: "insight-financial",
        title: "Financial close ahead of schedule",
        detail:
          "Q2 reconciliation complete with 98% confidence. Revenue variance under 0.3% vs. HubSpot.",
        dimensionId: "dim-financial",
        dimension: "Financial",
        confidence: 98,
        generatedAt: "1 hr ago",
        type: "positive",
      },
    },
  ],

  recommendationRules: [
    {
      findingIds: ["finding-ip-gap"],
      recommendation: {
        id: "rec-action-1",
        title: "Execute IP assignment amendments",
        priority: "high",
        dimensionId: "dim-legal",
        dimension: "Legal",
        description:
          "Send updated contractor agreements to 4 vendors missing IP clauses. Template ready in Box.",
        confidence: 91,
        estimatedHealthImpact: 3,
      },
    },
    {
      findingIds: ["finding-consent-gap", "finding-board-action"],
      recommendation: {
        id: "rec-action-2",
        title: "File retroactive board consents",
        priority: "high",
        dimensionId: "dim-governance",
        dimension: "Governance",
        description:
          "Prepare unanimous written consent for 3 option grants. Legal counsel draft attached.",
        confidence: 97,
        estimatedHealthImpact: 6,
      },
    },
    {
      findingIds: ["finding-concentration"],
      recommendation: {
        id: "rec-action-3",
        title: "Diversify top-customer exposure",
        priority: "medium",
        dimensionId: "dim-customer",
        dimension: "Customer",
        description:
          "Launch mid-market expansion pilot to reduce top-3 concentration below 45% by Q4.",
        confidence: 94,
        estimatedHealthImpact: 4,
      },
    },
    {
      findingIds: ["finding-soc2-pass"],
      recommendation: {
        id: "rec-action-4",
        title: "Complete SOC 2 observation period",
        priority: "medium",
        dimensionId: "dim-security",
        dimension: "Security",
        description:
          "3 of 5 control observation windows remain open. Target Type I report by August 15.",
        confidence: 92,
        estimatedHealthImpact: 4,
      },
    },
  ],

  riskRules: [
    {
      findingIds: ["finding-concentration"],
      recommendationId: "rec-action-3",
      risk: {
        id: "risk-1",
        title: "Customer concentration",
        severity: "high",
        dimensionId: "dim-customer",
        dimension: "Customer",
        summary:
          "Top 3 customers represent 58% of ARR. Loss of any one would materially impact runway.",
        whyItMatters:
          "Investors and boards flag concentration above 50%. A single churn event could reduce runway by 3+ months and trigger covenant reviews.",
        recommendation:
          "Launch mid-market expansion pilot to reduce top-3 concentration below 45% by Q4.",
        estimatedScoreImpact: 4,
        primaryEvidenceLabel: "HubSpot · ARR cohort analysis",
        explainPrompt: "Explain the customer concentration risk and show supporting evidence",
        confidence: 94,
      },
    },
    {
      findingIds: ["finding-ip-gap"],
      recommendationId: "rec-action-1",
      risk: {
        id: "risk-2",
        title: "Missing contractor IP assignment",
        severity: "medium",
        dimensionId: "dim-legal",
        dimension: "Legal",
        summary: "4 of 12 active contractor agreements lack signed IP assignment clauses.",
        whyItMatters:
          "IP ownership ambiguity is a standard diligence blocker. Acquirers and investors will require clean IP chain of title before closing.",
        recommendation:
          "Send IP assignment amendments to contractors C-104, C-108, C-111, and C-115 this week.",
        estimatedScoreImpact: 3,
        primaryEvidenceLabel: "Box · Legal folder audit",
        explainPrompt: "Explain the missing contractor IP assignment risk",
        confidence: 91,
      },
    },
    {
      findingIds: ["finding-consent-gap", "finding-board-action"],
      recommendationId: "rec-action-2",
      risk: {
        id: "risk-3",
        title: "Board consent cleanup",
        severity: "medium",
        dimensionId: "dim-governance",
        dimension: "Governance",
        summary: "3 option grants from 2024 missing board consent documentation in Carta.",
        whyItMatters:
          "Undocumented equity grants create compliance exposure and can delay fundraising. Boards and counsel will require retroactive consent.",
        recommendation:
          "File retroactive unanimous written consent before the July 22 board meeting.",
        estimatedScoreImpact: 6,
        primaryEvidenceLabel: "Carta · Equity grant review",
        explainPrompt: "Explain the board consent cleanup issue and why governance is at 71",
        confidence: 97,
      },
    },
  ],
};
