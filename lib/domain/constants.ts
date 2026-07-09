import type {
  ConnectorId,
  HealthDimensionId,
  HealthDimensionMeta,
  HealthStatus,
  RiskSeverity,
} from "./types";

export const HEALTH_DIMENSIONS: readonly HealthDimensionMeta[] = [
  {
    id: "financial",
    name: "Financial",
    description: "Cash, burn, margins, unit economics",
    defaultWeight: 1.2,
    iconPath: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  },
  {
    id: "customer",
    name: "Customer",
    description: "Retention, NPS, concentration, expansion",
    defaultWeight: 1.1,
    iconPath:
      "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  },
  {
    id: "governance",
    name: "Governance",
    description: "Board structure, voting rights, controls",
    defaultWeight: 0.9,
    iconPath: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    id: "legal",
    name: "Legal",
    description: "Contracts, IP, litigation, compliance",
    defaultWeight: 0.9,
    iconPath: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  },
  {
    id: "revenue_quality",
    name: "Revenue Quality",
    description: "Recurring vs. one-time, cohort trends",
    defaultWeight: 1.15,
    iconPath: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  },
  {
    id: "security",
    name: "Security",
    description: "SOC 2, access controls, data handling",
    defaultWeight: 1.0,
    iconPath: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  },
  {
    id: "people",
    name: "People",
    description: "Headcount, attrition, key-person risk",
    defaultWeight: 0.95,
    iconPath:
      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  },
  {
    id: "operations",
    name: "Operations",
    description: "Processes, SLAs, vendor dependencies",
    defaultWeight: 0.85,
    iconPath:
      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
] as const;

export const CONNECTOR_CATALOG: ReadonlyArray<{
  id: ConnectorId;
  name: string;
  description: string;
  color: string;
  status: "available" | "coming_soon";
}> = [
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Board decks, financial models, contracts",
    color: "#4285F4",
    status: "available",
  },
  {
    id: "box",
    name: "Box",
    description: "Legal docs, data rooms, compliance files",
    color: "#0061D5",
    status: "available",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "P&L, cash flow, AR/AP, burn rate",
    color: "#2CA01C",
    status: "available",
  },
  {
    id: "carta",
    name: "Carta",
    description: "Cap table, equity grants, 409A valuations",
    color: "#5B4FCF",
    status: "available",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Pipeline, churn signals, customer health",
    color: "#FF7A59",
    status: "available",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments, MRR, failed charges",
    color: "#635BFF",
    status: "coming_soon",
  },
  {
    id: "gusto",
    name: "Gusto",
    description: "Payroll, headcount, benefits",
    color: "#F45D48",
    status: "coming_soon",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "CRM pipeline and account health",
    color: "#00A1E0",
    status: "coming_soon",
  },
];

export function statusFromScore(score: number): HealthStatus {
  if (score >= 75) return "healthy";
  if (score >= 55) return "watch";
  return "risk";
}

export function severityRank(severity: RiskSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

export function dimensionMeta(
  id: HealthDimensionId,
): HealthDimensionMeta {
  const meta = HEALTH_DIMENSIONS.find((d) => d.id === id);
  if (!meta) {
    throw new Error(`Unknown health dimension: ${id}`);
  }
  return meta;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
