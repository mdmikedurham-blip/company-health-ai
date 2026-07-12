import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CORPUS_ROOT,
  generateNorthstarBundle,
  writeCompanyBundle,
} from "./generate";
import { validateCompanyBundle } from "../validators/consistency";
import { NORTHSTAR_COMPANY_ID } from "../profiles/northstar-growth-saas";
import type { GeneratedCompanyBundle } from "../schemas/types";

function loadBundleFromDisk(
  companyId = NORTHSTAR_COMPANY_ID,
): GeneratedCompanyBundle {
  const dir = join(CORPUS_ROOT, companyId);
  if (!existsSync(dir)) {
    const bundle = generateNorthstarBundle();
    writeCompanyBundle(bundle);
  }
  const profile = JSON.parse(
    readFileSync(join(dir, "profile.json"), "utf8"),
  );
  const scenario = JSON.parse(
    readFileSync(join(dir, "scenario.json"), "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  );
  const golden = JSON.parse(
    readFileSync(join(dir, "golden-truth.json"), "utf8"),
  );
  const files = new Map<string, Uint8Array | string>();
  for (const art of manifest.artifacts) {
    const path = join(dir, art.relativePath);
    if (art.format === "xlsx") {
      files.set(art.relativePath, new Uint8Array(readFileSync(path)));
    } else {
      files.set(art.relativePath, readFileSync(path, "utf8"));
    }
  }
  return { profile, scenario, manifest, golden, files };
}

export function validateCorpus(): {
  ok: boolean;
  report: ReturnType<typeof validateCompanyBundle>;
} {
  const bundle = loadBundleFromDisk();
  const report = validateCompanyBundle(bundle);
  return { ok: report.ok, report };
}

export async function main(): Promise<void> {
  const { ok, report } = validateCorpus();
  const out = {
    ok,
    companyId: report.companyId,
    issueCount: report.issues.length,
    issues: report.issues,
  };
  console.log(JSON.stringify(out, null, 2));
  if (!ok) process.exit(1);
}
