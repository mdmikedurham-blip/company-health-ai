import {
  SYNTHETIC_DATA_CLASS,
  SYNTHETIC_ID_PREFIX,
  type CanonicalCompanyProfile,
  type ScenarioConfig,
  type ScenarioId,
} from "../schemas/types";
import { jitter, mulberry32 } from "../seed";

export const NORTHSTAR_COMPANY_ID = `${SYNTHETIC_ID_PREFIX}northstar-growth-saas`;
export const NORTHSTAR_SEED = 9001;

/**
 * Growth-stage B2B SaaS — average health with material concentration risk.
 * All document generators must read from this profile (or scenario overlays).
 */
export function buildNorthstarGrowthSaasProfile(
  seed = NORTHSTAR_SEED,
): CanonicalCompanyProfile {
  const rng = mulberry32(seed);
  const arr = Math.round(jitter(rng, 4_800_000, 0.02));
  const monthlyBurn = Math.round(jitter(rng, 220_000, 0.03));
  const cash = Math.round(jitter(rng, 2_640_000, 0.02));
  const runway = Math.round((cash / monthlyBurn) * 10) / 10;

  return {
    synthetic: true,
    dataClass: SYNTHETIC_DATA_CLASS,
    companyId: NORTHSTAR_COMPANY_ID,
    companyName: "Northstar Analytics",
    industry: "B2B SaaS",
    businessModel: "B2B analytics subscription platform",
    revenueModel: "Annual recurring revenue (ARR) with usage overages",
    lifecycleStage: "Growth",
    jurisdiction: "Delaware, USA",
    entityType: "C-Corp",
    foundingDate: "2019-04-12",
    annualRevenue: arr,
    arr,
    growthRate: 0.28,
    grossMargin: 0.74,
    ebitda: Math.round(arr * 0.08),
    cash,
    monthlyBurn,
    debt: 0,
    cashRunwayMonths: runway,
    employeeCount: 62,
    customerCount: 148,
    top3CustomerArrShare: 0.47,
    churnRate: 0.09,
    nrr: 1.08,
    recurringRevenueShare: 0.91,
    fundingHistory: [
      { round: "Seed", amount: 2_500_000, date: "2020-06-01" },
      { round: "Series A", amount: 12_000_000, date: "2022-09-15" },
    ],
    capTableSummary:
      "Founders 38%, Series A 32%, Seed 18%, Option pool 12% (fully diluted).",
    boardStructure: {
      chair: "Priya Shah",
      directors: ["Priya Shah", "Marcus Cole", "Elena Brooks", "Jordan Hale"],
      meetingCadence: "quarterly",
    },
    auditStatus: "No financial statement audit; SOC 2 Type I in progress",
    securityMaturity: "growing",
    strategy:
      "Expand mid-market analytics seats in North America; deepen retention on top accounts.",
    majorRisks: [
      "Customer concentration — top three accounts ~47% of ARR",
      "Runway depends on holding burn near plan",
    ],
    knownMissingControls: [
      "SOC 2 Type II not complete",
      "Formal vendor risk reviews incomplete",
    ],
    seed,
  };
}

export function buildNorthstarScenario(
  profile: CanonicalCompanyProfile,
): ScenarioConfig {
  const flags: ScenarioId[] = [
    "average",
    "high_customer_concentration",
    "aggressive_forecast",
  ];
  return {
    synthetic: true,
    dataClass: SYNTHETIC_DATA_CLASS,
    companyId: profile.companyId,
    seed: profile.seed,
    primary: "high_customer_concentration",
    flags,
  };
}
