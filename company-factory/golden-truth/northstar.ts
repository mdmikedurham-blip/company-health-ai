import type {
  CanonicalCompanyProfile,
  GoldenTruth,
  ScenarioConfig,
} from "../schemas/types";
import { SYNTHETIC_DATA_CLASS } from "../schemas/types";

/**
 * Golden truth is authored from the profile/scenario — never from engine output.
 */
export function buildNorthstarGoldenTruth(
  profile: CanonicalCompanyProfile,
  scenario: ScenarioConfig,
): GoldenTruth {
  return {
    synthetic: true,
    dataClass: SYNTHETIC_DATA_CLASS,
    companyId: profile.companyId,
    seed: profile.seed,
    lifecycleStage: profile.lifecycleStage,
    assessmentGoal: "run-the-company",
    classification: {
      industry: profile.industry,
      stage: profile.lifecycleStage,
    },
    financialHealth: {
      available: true,
      expectedRange: [65, 88],
      confidenceRange: [70, 95],
    },
    governance: {
      available: true,
      expectedRange: [55, 85],
      confidenceRange: [60, 90],
    },
    expectedRisks: [
      {
        id: "risk-concentration",
        titleContains: ["concentration", "customer"],
        severity: "high",
      },
    ],
    expectedRecommendations: [
      {
        id: "rec-diversify",
        titleContains: ["diversif", "retention", "concentration"],
      },
    ],
    expectedCoverage: {
      minDocuments: 12,
      requiredCategories: [
        "financial",
        "customer",
        "governance",
        "security",
        "people",
        "strategy",
      ],
    },
    missingEvidence: ["SOC 2 Type II report", "Vendor risk register"],
    nextBestUpload: "SOC 2 Type II or completed security questionnaire pack",
    doctor: {
      firstObservationContains: ["concentration", "ARR", "customer"],
      firstQuestionContains: ["top", "customer", "ARR"],
    },
    expectedFinancialFacts: [
      "revenue",
      "grossMargin",
      "ebitda",
      "cashBalance",
      "burnRateMonthly",
      "cashRunwayMonths",
      "top3CustomerArrShare",
      "revenueGrowth",
      "churnRate",
      "netRevenueRetention",
    ],
    playbookReadiness: {
      minCoveragePercent: 40,
      expectedBand: "partial",
    },
    notes: [
      "Scenario primary: high_customer_concentration",
      `Flags: ${scenario.flags.join(",")}`,
      "Weak forecast is intentional — must not override actual ARR in consistency checks.",
    ],
  };
}
