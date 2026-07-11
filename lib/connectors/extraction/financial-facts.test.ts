import { describe, expect, it } from "vitest";
import {
  extractFinancialObservations,
  hasEnoughFinancialFacts,
  mergeFinancialFactsInto,
  MIN_FINANCIAL_FACTS_TO_SCORE,
} from "./financial-facts";
import { extractDocument } from "./index";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import type { RawDocument } from "@/lib/connectors/documents/types";
import { runInsightEngine, DEFAULT_AS_OF } from "@/lib/intelligence";

/** Minimal store-compressed XLSX zip builder (same approach as ooxml.test.ts). */
function buildStoreZip(files: Record<string, string>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, 0, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  for (const c of central) {
    out.set(c, o);
    o += c.length;
  }
  out.set(end, o);
  return out;
}

function buildFinancialXlsx(): Uint8Array {
  const shared = [
    "Metric",
    "FY2025 Actual",
    "Revenue",
    "2400000",
    "Gross Margin",
    "72%",
    "EBITDA",
    "180000",
    "Cash Balance",
    "900000",
    "Monthly Burn",
    "45000",
    "Cash Runway",
    "20",
    "Recurring Revenue Share",
    "88%",
    "Top 3 Customer ARR Share",
    "41%",
  ];
  const sst = `<sst>${shared.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`;

  // Row helper: each pair of shared-string indices
  const row = (r: number, a: number, b: number) =>
    `<row r="${r}"><c r="A${r}" t="s"><v>${a}</v></c><c r="B${r}" t="s"><v>${b}</v></c></row>`;

  const sheetData = [
    row(1, 0, 1),
    row(2, 2, 3),
    row(3, 4, 5),
    row(4, 6, 7),
    row(5, 8, 9),
    row(6, 10, 11),
    row(7, 12, 13),
    row(8, 14, 15),
    row(9, 16, 17),
  ].join("");

  return buildStoreZip({
    "xl/workbook.xml":
      '<workbook><sheets><sheet name="P&amp;L Actuals" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": sst,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetData}</sheetData></worksheet>`,
  });
}

describe("financial spreadsheet fact extraction", () => {
  it("extracts labeled financial metrics with worksheet/period/basis context", () => {
    const extracted = {
      title: "model.xlsx",
      text: "## P&L Actuals\nRevenue\t$2,400,000\nGross Margin\t72%\nCash Balance\t900000\nCash Runway\t20\n",
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "sheet-1",
          title: "P&L Actuals",
          text: "Revenue\t$2,400,000\nGross Margin\t72%\nCash Balance\t900000\nCash Runway\t20\n",
          order: 1,
          metadata: { sheet: "P&L Actuals", rowCount: 4 },
        },
      ],
    };

    const observations = extractFinancialObservations(extracted);
    const keys = observations.map((o) => o.key).sort();
    expect(keys).toEqual(
      ["cashBalance", "cashRunwayMonths", "grossMargin", "revenue"].sort(),
    );
    expect(observations.find((o) => o.key === "revenue")?.value).toBe(2_400_000);
    expect(observations.find((o) => o.key === "grossMargin")?.value).toBeCloseTo(
      0.72,
    );
    expect(observations.find((o) => o.key === "cashRunwayMonths")?.value).toBe(20);
    expect(observations.every((o) => o.worksheet === "P&L Actuals")).toBe(true);
    expect(observations.find((o) => o.key === "revenue")?.basis).toBe("actual");
  });

  it("does not infer runway from cash and burn", () => {
    const extracted = {
      title: "partial.xlsx",
      text: "Cash Balance\t500000\nMonthly Burn\t25000\n",
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "sheet-1",
          title: "Cash",
          text: "Cash Balance\t500000\nMonthly Burn\t25000\n",
          order: 1,
          metadata: { sheet: "Cash" },
        },
      ],
    };
    const { facts } = mergeFinancialFactsInto({}, extracted);
    expect(facts.cashBalance).toBe(500_000);
    expect(facts.burnRateMonthly).toBe(25_000);
    expect(facts.cashRunwayMonths).toBeUndefined();
    expect(hasEnoughFinancialFacts(facts)).toBe(true);
  });

  it("prefers actuals over forecast for the same metric", () => {
    const extracted = {
      title: "both.xlsx",
      text: "## Forecast\nRevenue\t3000000\n## Actuals\nRevenue\t2400000\n",
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "s1",
          title: "Forecast",
          text: "Revenue\t3000000\n",
          order: 1,
          metadata: { sheet: "Forecast" },
        },
        {
          id: "s2",
          title: "Actuals",
          text: "Revenue\t2400000\n",
          order: 2,
          metadata: { sheet: "Actuals" },
        },
      ],
    };
    const observations = extractFinancialObservations(extracted);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.value).toBe(2_400_000);
    expect(observations[0]?.basis).toBe("actual");
  });
});

describe("XLSX upload → structured financial evidence → Financial scored", () => {
  it("scores Financial from a representative financial workbook", () => {
    const bytes = buildFinancialXlsx();
    const extracted = extractDocument({
      title: "company-financials.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes,
      sourceMetadata: { document_id: "doc-fin-1", source: "manual-upload" },
    });

    expect(extracted.metadata.format).toBe("XLSX");
    expect(extracted.sections[0]?.title).toBe("P&L Actuals");
    expect(extracted.sections[0]?.metadata?.rowCount).toBeGreaterThan(0);

    const raw: RawDocument = {
      externalId: "doc-fin-1",
      connectorId: "manual-upload",
      sourceSystem: "Manual Upload",
      title: "company-financials.xlsx",
      rawSummary: extracted.text.slice(0, 200),
      syncedAt: "2026-07-11T12:00:00.000Z",
      path: "company-financials.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      metadata: { document_id: "doc-fin-1", source: "manual-upload" },
    };

    const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
      evidenceId: "doc-fin-1",
    });

    expect(typeof evidence.extractedFacts.revenue).toBe("number");
    expect(evidence.extractedFacts.revenue).toBe(2_400_000);
    expect(evidence.extractedFacts.grossMargin).toBeCloseTo(0.72);
    expect(evidence.extractedFacts.cashBalance).toBe(900_000);
    expect(evidence.extractedFacts.cashRunwayMonths).toBe(20);
    expect(evidence.extractedFacts.burnRateMonthly).toBe(45_000);
    expect(evidence.extractedFacts.recurringRevenueShare).toBeCloseTo(0.88);
    expect(evidence.extractedFacts.top3CustomerArrShare).toBeCloseTo(0.41);
    expect(evidence.extractedFacts.financialFactsComplete).toBe(true);
    expect(evidence.dimensionId).toBe("dim-financial");

    const engine = runInsightEngine({
      companyId: "co-fin",
      evidence: [evidence],
      asOf: DEFAULT_AS_OF,
    });

    const financial = engine.dimensions.find((d) => d.id === "dim-financial");
    expect(financial?.scored).toBe(true);
    expect(financial?.status).not.toBe("insufficient");
    expect(financial?.summary.toLowerCase()).not.toContain("no evidence");
    expect(financial?.summary.toLowerCase()).not.toContain("not enough evidence");
    expect(
      engine.findings.some((f) => f.id === "finding-financial-metrics"),
    ).toBe(true);
    expect(
      engine.findings.some((f) => f.id === "finding-runway"),
    ).toBe(true); // 20 > 18 → runway-positive
  });

  it("shows missing required financial fields when incomplete", () => {
    const extracted = {
      title: "thin.xlsx",
      text: "## Sheet1\nRevenue\t100\n",
      metadata: { format: "XLSX" },
      sections: [
        {
          id: "s1",
          title: "Sheet1",
          text: "Revenue\t100\n",
          order: 1,
          metadata: { sheet: "Sheet1", rowCount: 1 },
        },
      ],
    };
    const raw: RawDocument = {
      externalId: "doc-thin",
      connectorId: "manual-upload",
      sourceSystem: "Manual Upload",
      title: "thin.xlsx",
      rawSummary: "Revenue",
      syncedAt: "2026-07-11T12:00:00.000Z",
      path: "thin.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      metadata: { document_id: "doc-thin" },
    };
    const { evidence } = runEvidenceExtractionPipeline(
      raw,
      extracted as never,
      { evidenceId: "doc-thin" },
    );
    expect(hasEnoughFinancialFacts(evidence.extractedFacts)).toBe(false);
    expect(
      (evidence.extractedFacts.financialMetricCount as number) <
        MIN_FINANCIAL_FACTS_TO_SCORE,
    ).toBe(true);

    const engine = runInsightEngine({
      companyId: "co-thin",
      evidence: [evidence],
      asOf: DEFAULT_AS_OF,
    });
    const financial = engine.dimensions.find((d) => d.id === "dim-financial");
    // One fact alone should not score Financial
    expect(financial?.scored).toBe(false);
    expect(financial?.summary).toMatch(/Missing required financial fields/i);
  });
});
