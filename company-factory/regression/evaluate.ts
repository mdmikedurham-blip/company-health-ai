import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractDocument } from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import type { RawDocument } from "@/lib/connectors/documents/types";
import { FINANCIAL_FACT_KEYS } from "@/lib/connectors/extraction/financial-facts";
import { CORPUS_ROOT, generateNorthstarBundle, writeCompanyBundle } from "./generate";
import { NORTHSTAR_COMPANY_ID } from "../profiles/northstar-growth-saas";
import type { GoldenTruth } from "../schemas/types";

export type EvaluateReport = {
  ok: boolean;
  companyId: string;
  metrics: {
    financialFactHitRate: number;
    expectedFactsPresent: string[];
    expectedFactsMissing: string[];
    documentCount: number;
    minDocumentsMet: boolean;
    concentrationSignalPresent: boolean;
    syntheticMarkersPresent: boolean;
    productionContamination: boolean;
  };
  tolerances: {
    financialFactHitRateMin: number;
  };
  notes: string[];
};

/**
 * In-memory evaluation: extract financial workbook + text artifacts and
 * compare to golden truth with tolerances. Does not persist to Supabase.
 */
export async function evaluateNorthstar(): Promise<EvaluateReport> {
  const dir = join(CORPUS_ROOT, NORTHSTAR_COMPANY_ID);
  if (!existsSync(dir)) {
    writeCompanyBundle(generateNorthstarBundle());
  }

  const golden = JSON.parse(
    readFileSync(join(dir, "golden-truth.json"), "utf8"),
  ) as GoldenTruth;
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  ) as {
    artifacts: Array<{
      id: string;
      relativePath: string;
      mimeType: string;
      title: string;
      format: string;
    }>;
  };

  const notes: string[] = [];
  const factKeys = new Set<string>();
  let concentrationSignal = false;
  let blob = "";

  for (const art of manifest.artifacts) {
    const path = join(dir, art.relativePath);
    const bytes =
      art.format === "xlsx"
        ? new Uint8Array(readFileSync(path))
        : new TextEncoder().encode(readFileSync(path, "utf8"));

    if (art.format !== "xlsx") {
      blob += readFileSync(path, "utf8");
    }

    const raw: RawDocument = {
      externalId: art.id,
      connectorId: "manual-upload",
      sourceSystem: "factory-corpus",
      title: art.title,
      rawSummary: art.title,
      syncedAt: "2026-06-30T00:00:00.000Z",
      path: art.relativePath,
      mimeType: art.mimeType,
      metadata: {
        document_id: art.id,
        synthetic: true,
        dataClass: "factory-corpus",
      },
    };

    try {
      const extracted = await extractDocument({
        title: art.title,
        mimeType: art.mimeType,
        bytes,
      });
      const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
        evidenceId: art.id,
      });
      for (const key of Object.keys(evidence.extractedFacts ?? {})) {
        if ((FINANCIAL_FACT_KEYS as readonly string[]).includes(key)) {
          factKeys.add(key);
        }
      }
      const text = extracted.text.toLowerCase();
      if (text.includes("concentration") || text.includes("top 3")) {
        concentrationSignal = true;
      }
      blob += extracted.text;
    } catch (err) {
      notes.push(
        `extract_failed:${art.id}:${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  const expected = golden.expectedFinancialFacts;
  const present = expected.filter((k) => factKeys.has(k));
  const missing = expected.filter((k) => !factKeys.has(k));
  const hitRate = expected.length === 0 ? 1 : present.length / expected.length;

  const productionContamination =
    /peachjar/i.test(blob) || /company-acme/i.test(blob);
  const syntheticMarkersPresent =
    /SYNTHETIC|factory-corpus|synthetic-northstar/i.test(blob);

  const financialFactHitRateMin = 0.7;
  const minDocumentsMet =
    manifest.artifacts.length >= golden.expectedCoverage.minDocuments;

  const ok =
    hitRate >= financialFactHitRateMin &&
    minDocumentsMet &&
    concentrationSignal &&
    syntheticMarkersPresent &&
    !productionContamination;

  return {
    ok,
    companyId: golden.companyId,
    metrics: {
      financialFactHitRate: Math.round(hitRate * 1000) / 1000,
      expectedFactsPresent: present,
      expectedFactsMissing: missing,
      documentCount: manifest.artifacts.length,
      minDocumentsMet,
      concentrationSignalPresent: concentrationSignal,
      syntheticMarkersPresent,
      productionContamination,
    },
    tolerances: { financialFactHitRateMin },
    notes,
  };
}

export async function main(): Promise<void> {
  const report = await evaluateNorthstar();
  const outDir = join(CORPUS_ROOT, NORTHSTAR_COMPANY_ID, "reports");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "evaluate.json"), JSON.stringify(report, null, 2));
  const md = [
    `# Corpus evaluation — ${report.companyId}`,
    "",
    `OK: **${report.ok}**`,
    "",
    `| Metric | Value |`,
    `|---|---|`,
    `| Financial fact hit rate | ${report.metrics.financialFactHitRate} (min ${report.tolerances.financialFactHitRateMin}) |`,
    `| Documents | ${report.metrics.documentCount} |`,
    `| Concentration signal | ${report.metrics.concentrationSignalPresent} |`,
    `| Synthetic markers | ${report.metrics.syntheticMarkersPresent} |`,
    `| Production contamination | ${report.metrics.productionContamination} |`,
    "",
    `Missing facts: ${report.metrics.expectedFactsMissing.join(", ") || "none"}`,
    "",
    ...(report.notes.length
      ? ["## Notes", ...report.notes.map((n) => `- ${n}`)]
      : []),
  ].join("\n");
  writeFileSync(join(outDir, "evaluate.md"), md);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
