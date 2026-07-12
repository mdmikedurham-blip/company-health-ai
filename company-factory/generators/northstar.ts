import type {
  ArtifactManifest,
  ArtifactRecord,
  CanonicalCompanyProfile,
  GeneratedCompanyBundle,
  ScenarioConfig,
} from "../schemas/types";
import { SYNTHETIC_DATA_CLASS } from "../schemas/types";
import { buildLabelValueXlsx } from "./zip";

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function money(n: number): string {
  return String(Math.round(n));
}

export function generateNorthstarArtifacts(
  profile: CanonicalCompanyProfile,
  scenario: ScenarioConfig,
): { manifest: ArtifactManifest; files: Map<string, Uint8Array | string> } {
  const files = new Map<string, Uint8Array | string>();
  const artifacts: ArtifactRecord[] = [];
  const push = (
    record: Omit<ArtifactRecord, "relativePath"> & { fileName: string },
    content: Uint8Array | string,
  ) => {
    const relativePath = `artifacts/${record.fileName}`;
    artifacts.push({ ...record, relativePath });
    files.set(relativePath, content);
  };

  // 1. Strong monthly P&L / KPI workbook
  push(
    {
      id: "art-fin-pnl",
      category: "financial",
      title: "Monthly P&L and KPI actuals",
      fileName: "01-pnl-kpis.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      quality: "strong",
      format: "xlsx",
      binds: ["arr", "grossMargin", "ebitda", "cash", "monthlyBurn", "cashRunwayMonths"],
    },
    buildLabelValueXlsx("P&L Actuals", [
      ["Metric", "FY2026 Actual"],
      ["Revenue", money(profile.arr)],
      ["Gross Margin", pct(profile.grossMargin)],
      ["EBITDA", money(profile.ebitda)],
      ["Cash Balance", money(profile.cash)],
      ["Monthly Burn", money(profile.monthlyBurn)],
      ["Cash Runway", String(profile.cashRunwayMonths)],
      ["Recurring Revenue Share", pct(profile.recurringRevenueShare)],
      ["Top 3 Customer ARR Share", pct(profile.top3CustomerArrShare)],
      ["Revenue Growth", pct(profile.growthRate)],
      ["Net Revenue Retention", pct(profile.nrr)],
      ["Churn Rate", pct(profile.churnRate)],
    ]),
  );

  // 2. Average cash / balance summary
  push(
    {
      id: "art-fin-cash",
      category: "financial",
      title: "Cash and balance summary",
      fileName: "02-cash-balance.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      quality: "average",
      format: "xlsx",
      binds: ["cash", "debt", "monthlyBurn"],
    },
    buildLabelValueXlsx("Cash", [
      ["Metric", "2026-06 Actual"],
      ["Cash Balance", money(profile.cash)],
      ["Debt", money(profile.debt)],
      ["Monthly Burn", money(profile.monthlyBurn)],
      ["Cash Runway", String(profile.cashRunwayMonths)],
    ]),
  );

  // 3. Weak / aggressive forecast
  const aggressiveRevenue = Math.round(profile.arr * 1.65);
  push(
    {
      id: "art-fin-forecast",
      category: "financial",
      title: "Aggressive revenue forecast",
      fileName: "03-forecast-aggressive.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      quality: "weak",
      format: "xlsx",
      binds: ["arr"],
    },
    buildLabelValueXlsx("Forecast", [
      ["Metric", "FY2027 Forecast"],
      ["Revenue", money(aggressiveRevenue)],
      ["Gross Margin", pct(0.82)],
      ["EBITDA", money(Math.round(aggressiveRevenue * 0.22))],
      ["Assumption", "Assumes 65% ARR growth without churn increase"],
    ]),
  );

  // 4–6. Customer / revenue CSVs
  const customers = buildCustomerExport(profile);
  push(
    {
      id: "art-cust-export",
      category: "customer",
      title: "Customer revenue export",
      fileName: "04-customer-revenue.csv",
      mimeType: "text/csv",
      quality: "strong",
      format: "csv",
      binds: ["top3CustomerArrShare", "arr", "customerCount"],
    },
    customers.csv,
  );

  push(
    {
      id: "art-arr-mrr",
      category: "customer",
      title: "ARR / MRR report",
      fileName: "05-arr-mrr.csv",
      mimeType: "text/csv",
      quality: "average",
      format: "csv",
      binds: ["arr", "growthRate"],
    },
    [
      "metric,value,period",
      `ARR,${profile.arr},2026-06`,
      `MRR,${Math.round(profile.arr / 12)},2026-06`,
      `Revenue Growth,${profile.growthRate},TTM`,
      `Recurring Revenue Share,${profile.recurringRevenueShare},2026-06`,
      `# SYNTHETIC factory-corpus ${profile.companyId}`,
    ].join("\n"),
  );

  push(
    {
      id: "art-churn",
      category: "customer",
      title: "Churn and NRR report",
      fileName: "06-churn-nrr.csv",
      mimeType: "text/csv",
      quality: "average",
      format: "csv",
      binds: ["churnRate", "nrr"],
    },
    [
      "metric,value,period",
      `Churn Rate,${profile.churnRate},TTM`,
      `Net Revenue Retention,${profile.nrr},TTM`,
      `# SYNTHETIC factory-corpus ${profile.companyId}`,
    ].join("\n"),
  );

  // 7. Concentration report
  push(
    {
      id: "art-concentration",
      category: "customer",
      title: "Customer concentration report",
      fileName: "07-concentration.txt",
      mimeType: "text/plain",
      quality: "strong",
      format: "txt",
      binds: ["top3CustomerArrShare"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Customer concentration report`,
      `Top 3 Customer ARR Share: ${pct(profile.top3CustomerArrShare)}`,
      `Customer count: ${profile.customerCount}`,
      `ARR: ${profile.arr}`,
      `Risk: concentration above 40% of ARR.`,
      `Scenario flags: ${scenario.flags.join(", ")}`,
    ].join("\n"),
  );

  // 8. Strong board minutes
  push(
    {
      id: "art-board-minutes",
      category: "governance",
      title: "Q2 board minutes",
      fileName: "08-board-minutes.txt",
      mimeType: "text/plain",
      quality: "strong",
      format: "txt",
      binds: ["boardStructure", "arr", "cash"],
    },
    buildStrongBoardMinutes(profile),
  );

  // 9. Weak board consent (problematic)
  push(
    {
      id: "art-board-weak",
      category: "governance",
      title: "Incomplete written consent draft",
      fileName: "09-board-consent-weak.txt",
      mimeType: "text/plain",
      quality: "weak",
      format: "txt",
      binds: ["boardStructure"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Written consent (DRAFT — unsigned)`,
      `Some directors discussed option grants.`,
      `Attendance incomplete.`,
      `No recorded vote totals.`,
      `Date: TBD`,
    ].join("\n"),
  );

  // 10. Cap table
  push(
    {
      id: "art-cap-table",
      category: "governance",
      title: "Cap table summary",
      fileName: "10-cap-table.csv",
      mimeType: "text/csv",
      quality: "average",
      format: "csv",
      binds: ["capTableSummary", "fundingHistory"],
    },
    [
      "holder,class,fully_diluted_pct",
      "Founders,Common,38",
      "Series A,Preferred,32",
      "Seed,Preferred,18",
      "Option Pool,Options,12",
      `# ${profile.capTableSummary}`,
      `# SYNTHETIC factory-corpus ${profile.companyId}`,
    ].join("\n"),
  );

  // 11. Security policy (average)
  push(
    {
      id: "art-security",
      category: "security",
      title: "Information security policy",
      fileName: "11-security-policy.txt",
      mimeType: "text/plain",
      quality: "average",
      format: "txt",
      binds: ["securityMaturity", "knownMissingControls"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Information Security Policy`,
      `Maturity target: ${profile.securityMaturity}`,
      `MFA required for production systems.`,
      `Incident response: notify security@northstar.example within 24h.`,
      `Known gaps: ${profile.knownMissingControls.join("; ")}`,
      `SOC 2 Type II: not complete.`,
    ].join("\n"),
  );

  // 12. Employee roster
  push(
    {
      id: "art-roster",
      category: "people",
      title: "Employee roster",
      fileName: "12-employee-roster.csv",
      mimeType: "text/csv",
      quality: "strong",
      format: "csv",
      binds: ["employeeCount"],
    },
    buildRosterCsv(profile),
  );

  // 13. Org chart
  push(
    {
      id: "art-org",
      category: "people",
      title: "Org chart narrative",
      fileName: "13-org-chart.txt",
      mimeType: "text/plain",
      quality: "average",
      format: "txt",
      binds: ["employeeCount"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Org chart (${profile.employeeCount} employees)`,
      `CEO → Product, Engineering, GTM, Finance`,
      `Board chair: ${profile.boardStructure.chair}`,
    ].join("\n"),
  );

  // 14. Product roadmap
  push(
    {
      id: "art-roadmap",
      category: "strategy",
      title: "Product roadmap",
      fileName: "14-product-roadmap.txt",
      mimeType: "text/plain",
      quality: "average",
      format: "txt",
      binds: ["strategy"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Product roadmap 2026 H2`,
      profile.strategy,
      `Themes: retention analytics, mid-market packaging, usage-based overages.`,
    ].join("\n"),
  );

  // 15. Strategic / operating plan
  push(
    {
      id: "art-strategy",
      category: "strategy",
      title: "Annual operating plan",
      fileName: "15-operating-plan.txt",
      mimeType: "text/plain",
      quality: "strong",
      format: "txt",
      binds: ["arr", "cash", "strategy", "majorRisks"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Annual operating plan`,
      `ARR plan: ${profile.arr}`,
      `Cash plan: ${profile.cash}`,
      `Burn plan: ${profile.monthlyBurn}/mo`,
      `Strategy: ${profile.strategy}`,
      `Major risks: ${profile.majorRisks.join(" | ")}`,
    ].join("\n"),
  );

  // 16. Sample customer contract excerpt
  push(
    {
      id: "art-contract",
      category: "legal",
      title: "Sample customer MSA excerpt",
      fileName: "16-customer-msa.txt",
      mimeType: "text/plain",
      quality: "average",
      format: "txt",
      binds: ["customerCount"],
    },
    [
      `SYNTHETIC / factory-corpus — ${profile.companyName}`,
      `Master Services Agreement (excerpt)`,
      `Customer: Helios Retail Group`,
      `Initial term: 24 months`,
      `Fees: annual subscription; usage overages billed quarterly.`,
    ].join("\n"),
  );

  const manifest: ArtifactManifest = {
    synthetic: true,
    dataClass: SYNTHETIC_DATA_CLASS,
    companyId: profile.companyId,
    seed: profile.seed,
    generatedAt: new Date(0).toISOString(),
    artifacts,
  };

  return { manifest, files };
}

function buildCustomerExport(profile: CanonicalCompanyProfile): {
  csv: string;
} {
  const top = [
    { name: "Helios Retail Group", share: 0.22 },
    { name: "Cascade Logistics", share: 0.15 },
    { name: "Beacon Health Ops", share: 0.1 },
  ];
  const sumTop = top.reduce((s, c) => s + c.share, 0);
  // Align to profile concentration
  const scale = profile.top3CustomerArrShare / sumTop;
  const rows = top.map((c) => ({
    name: c.name,
    arr: Math.round(profile.arr * c.share * scale),
  }));
  const used = rows.reduce((s, r) => s + r.arr, 0);
  const other = Math.max(0, profile.arr - used);
  const lines = [
    "customer,arr_usd,status",
    ...rows.map((r) => `${r.name},${r.arr},active`),
    `Other customers (${profile.customerCount - 3}),${other},active`,
    `# Top 3 Customer ARR Share target ${profile.top3CustomerArrShare}`,
    `# SYNTHETIC factory-corpus ${profile.companyId}`,
  ];
  return { csv: lines.join("\n") };
}

function buildStrongBoardMinutes(profile: CanonicalCompanyProfile): string {
  return [
    `SYNTHETIC / factory-corpus — ${profile.companyName}`,
    `Board of Directors — Minutes`,
    `Date: 2026-05-14`,
    `Chair: ${profile.boardStructure.chair}`,
    `Attendance: ${profile.boardStructure.directors.join(", ")} (quorum present)`,
    `Resolutions:`,
    `1. Approved Q1 financial package — ARR ${profile.arr}, cash ${profile.cash}. Vote: unanimous.`,
    `2. Approved option grant schedule for 4 employees. Vote: 4-0.`,
    `3. Discussed customer concentration (${Math.round(profile.top3CustomerArrShare * 100)}% top-3 ARR); directed GTM diversification plan.`,
    `Follow-up actions: CFO to circulate runway forecast; CRO to present top-account retention plan next meeting.`,
    `Signed: ${profile.boardStructure.chair}, Chair`,
  ].join("\n");
}

function buildRosterCsv(profile: CanonicalCompanyProfile): string {
  const depts = ["Engineering", "Product", "GTM", "Finance", "People"];
  const lines = ["employee_id,name,department,status"];
  for (let i = 1; i <= profile.employeeCount; i++) {
    const dept = depts[i % depts.length]!;
    lines.push(`E${String(i).padStart(3, "0")},Employee ${i},${dept},active`);
  }
  lines.push(`# headcount=${profile.employeeCount}`);
  lines.push(`# SYNTHETIC factory-corpus ${profile.companyId}`);
  return lines.join("\n");
}

export function assembleNorthstarBundle(
  profile: CanonicalCompanyProfile,
  scenario: ScenarioConfig,
  golden: import("../schemas/types").GoldenTruth,
): GeneratedCompanyBundle {
  const { manifest, files } = generateNorthstarArtifacts(profile, scenario);
  return { profile, scenario, manifest, golden, files };
}
