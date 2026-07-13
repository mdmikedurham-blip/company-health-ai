/**
 * End-to-end fixture: four XYZ Corp–style workbooks → structured facts →
 * evidence → classification → enterprise-value inputs.
 *
 * Uses synthetic content that mirrors the real uploads (messy $M / ~ / negative
 * tokens, multi-year revenue, CSV Metric:value shape). No hardcoded UI fallbacks.
 */

import { describe, expect, it } from "vitest";
import { classifyCompanyFromEvidence } from "@/lib/classification/classify-company";
import { estimateTransparentEnterpriseValue } from "@/lib/enterprise-value";
import { valuationInputFromEvidence } from "@/lib/value-navigator/input-from-evidence";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import type { RawDocument } from "@/lib/connectors/documents/types";
import { extractDocument } from "./index";
import {
  extractFinancialObservations,
  mergeFinancialFactsInto,
} from "./financial-facts";

/** Historical P&L — Year 1 / Year 2 revenue columns (TSV like XLSX extract). */
const XYZ_PNL_TSV = [
  "Metric\tYear 1\tYear 2",
  "Year 1 Revenue\t$500,000\t",
  "Year 2 Revenue\t\t$2,000,000",
  "Revenue\t$500,000\t$2,000,000",
  "Gross Margin\t68%\t71%",
  "EBITDA\t($1,200,000)\tnegative $2.38M",
].join("\n");

/** Cash / runway sheet with approximation markers. */
const XYZ_CASH_TSV = [
  "Metric\tValue",
  "Cash Balance\t~$2.8M",
  "Cash\tapproximately $2.8 M",
  "Monthly Burn\tapproximately $200k",
  "Cash Runway\t~14",
  "Runway\t~14 months",
].join("\n");

/** Customer metrics CSV (pre-fix Metric:value shape regression). */
const XYZ_CUSTOMERS_CSV = [
  "Metric,Value",
  'ARR,"$2.4M"',
  "Customer concentration,42%",
  "Net Revenue Retention,108%",
  "Churn Rate,2.5%",
  "Employees,15",
  "Employee Count,15",
].join("\n");

/** Headcount + renewal prose-style colon lines (CSV leftover / notes). */
const XYZ_PEOPLE_TXT = [
  "XYZ Corp operating snapshot",
  "Headcount: 15",
  "Team size: 15",
  "ARR: $2.4M",
  "Top 3 Customer ARR Share: 42%",
].join("\n");

function rawDoc(
  id: string,
  title: string,
  mimeType: string,
): RawDocument {
  return {
    externalId: id,
    connectorId: "manual-upload",
    sourceSystem: "Manual Upload",
    title,
    rawSummary: title,
    syncedAt: "2026-07-10T18:00:00.000Z",
    path: title,
    mimeType,
    metadata: { document_id: id, source: "manual-upload" },
  };
}

describe("XYZ Corp financial fact pipeline", () => {
  it("parses messy money tokens and prefers later year / larger revenue", () => {
    const extracted = {
      title: "XYZ Corp P&L.xlsx",
      text: XYZ_PNL_TSV,
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "sheet-1",
          title: "P&L",
          text: XYZ_PNL_TSV,
          order: 1,
          metadata: { sheet: "P&L" },
        },
      ],
    };
    const { facts } = mergeFinancialFactsInto({}, extracted);
    expect(facts.revenue).toBe(2_000_000);
    expect(facts.ebitda).toBe(-2_380_000);
    expect(facts.grossMargin).toBeCloseTo(0.71);
  });

  it("parses cash / burn / runway with ~ and approximately", () => {
    const extracted = {
      title: "XYZ Corp Cash.xlsx",
      text: XYZ_CASH_TSV,
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "sheet-1",
          title: "Cash",
          text: XYZ_CASH_TSV,
          order: 1,
          metadata: { sheet: "Cash" },
        },
      ],
    };
    const { facts } = mergeFinancialFactsInto({}, extracted);
    expect(facts.cashBalance).toBe(2_800_000);
    expect(facts.burnRateMonthly).toBe(200_000);
    expect(facts.cashRunwayMonths).toBe(14);
  });

  it("converts CSV Metric/Value rows into usable financial facts (not Label:value dead path)", async () => {
    const extracted = await extractDocument({
      title: "XYZ Corp Customers.csv",
      mimeType: "text/csv",
      text: XYZ_CUSTOMERS_CSV,
      sourceMetadata: { document_id: "xyz-customers" },
    });

    expect(extracted.metadata.format).toBe("CSV");
    // Tab-separated metric row must be present for the financial parser.
    expect(extracted.sections.some((s) => s.text.includes("\t"))).toBe(true);

    const observations = extractFinancialObservations(extracted);
    const keys = new Set(observations.map((o) => o.key));
    expect(keys.has("revenue")).toBe(true); // ARR
    expect(keys.has("top3CustomerArrShare")).toBe(true);
    expect(keys.has("netRevenueRetention")).toBe(true);
    expect(keys.has("employeeCount")).toBe(true);

    const { facts } = mergeFinancialFactsInto({}, extracted);
    expect(facts.revenue).toBe(2_400_000);
    expect(facts.top3CustomerArrShare).toBeCloseTo(0.42);
    expect(facts.netRevenueRetention).toBeCloseTo(1.08);
    expect(facts.employeeCount).toBe(15);
  });

  it("extracts employeeCount from headcount / team size labels", () => {
    const extracted = {
      title: "XYZ Corp People.txt",
      text: XYZ_PEOPLE_TXT,
      metadata: { format: "TXT" },
      sections: [
        {
          id: "s1",
          title: "Notes",
          text: XYZ_PEOPLE_TXT,
          order: 1,
        },
      ],
    };
    // TXT with colon lines — cellsFromRow must split Label: value
    const { facts } = mergeFinancialFactsInto({}, extracted);
    expect(facts.employeeCount).toBe(15);
    expect(facts.revenue).toBe(2_400_000);
    expect(facts.top3CustomerArrShare).toBeCloseTo(0.42);
  });

  it("carries facts through evidence → classification → EV inputs", async () => {
    const pnl = await extractDocument({
      title: "XYZ Corp Financials.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: `${XYZ_PNL_TSV}\n${XYZ_CASH_TSV}`,
      sourceMetadata: { document_id: "xyz-pnl" },
    });
    const customers = await extractDocument({
      title: "XYZ Corp Customers.csv",
      mimeType: "text/csv",
      text: XYZ_CUSTOMERS_CSV,
      sourceMetadata: { document_id: "xyz-customers" },
    });
    const people = await extractDocument({
      title: "XYZ Corp People.txt",
      mimeType: "text/plain",
      text: XYZ_PEOPLE_TXT,
      sourceMetadata: { document_id: "xyz-people" },
    });
    const cash = await extractDocument({
      title: "XYZ Corp Cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: XYZ_CASH_TSV,
      sourceMetadata: { document_id: "xyz-cash" },
    });

    const docs = [
      {
        extracted: pnl,
        raw: rawDoc(
          "xyz-pnl",
          "XYZ Corp Financials.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      },
      {
        extracted: cash,
        raw: rawDoc(
          "xyz-cash",
          "XYZ Corp Cash.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      },
      {
        extracted: customers,
        raw: rawDoc("xyz-customers", "XYZ Corp Customers.csv", "text/csv"),
      },
      {
        extracted: people,
        raw: rawDoc("xyz-people", "XYZ Corp People.txt", "text/plain"),
      },
    ];

    const evidence = docs.map(({ extracted, raw }) => {
      const { evidence: ev } = runEvidenceExtractionPipeline(raw, extracted, {
        evidenceId: raw.externalId,
      });
      return ev;
    });

    // Stage: structured facts persisted on evidence (not dropped).
    const allFacts = evidence.map((e) => e.extractedFacts);
    expect(allFacts.some((f) => f.revenue === 2_400_000 || f.revenue === 2_000_000)).toBe(
      true,
    );
    expect(allFacts.some((f) => f.cashBalance === 2_800_000)).toBe(true);
    expect(allFacts.some((f) => f.ebitda === -2_380_000)).toBe(true);
    expect(allFacts.some((f) => f.burnRateMonthly === 200_000)).toBe(true);
    expect(allFacts.some((f) => f.cashRunwayMonths === 14)).toBe(true);
    expect(allFacts.some((f) => f.employeeCount === 15)).toBe(true);
    expect(
      allFacts.some(
        (f) =>
          typeof f.top3CustomerArrShare === "number" &&
          Math.abs((f.top3CustomerArrShare as number) - 0.42) < 0.01,
      ),
    ).toBe(true);

    // Stage: snapshot aggregation / valuation input.
    const valuationInput = valuationInputFromEvidence({
      companyId: "xyz-corp",
      snapshotId: "snap-xyz",
      assessmentGoal: "run-the-company",
      evidence,
    });
    expect(valuationInput.revenue).toBe(2_400_000);
    expect(valuationInput.ebitda).toBe(-2_380_000);
    expect(valuationInput.cash).toBe(2_800_000);
    expect(valuationInput.top3CustomerArrShare).toBeCloseTo(0.42);
    expect(valuationInput.cashRunwayMonths).toBe(14);

    // Stage: company classification uses facts (not prose-only).
    const classification = classifyCompanyFromEvidence({ evidence });
    expect(classification.effective.annualRevenueRange).toBe("1m-10m");
    expect(classification.effective.employeeCountRange).toBe("6-20");

    // Stage: negative EBITDA must not block unlock when cash/revenue present.
    const ev = estimateTransparentEnterpriseValue({
      companyId: "xyz-corp",
      snapshotId: "snap-xyz",
      assessmentGoal: "run-the-company",
      evidence,
    });
    expect(ev.available).toBe(true);
    expect(ev.missingUnlockInput).toBeNull();
    expect(ev.missingInputs ?? []).not.toContain("cashBalance");
    expect(ev.missingInputs ?? []).not.toContain("revenue");
  });
});
