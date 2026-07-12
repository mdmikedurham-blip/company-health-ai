import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildNorthstarGrowthSaasProfile,
  buildNorthstarScenario,
  NORTHSTAR_COMPANY_ID,
} from "../profiles/northstar-growth-saas";
import { assembleNorthstarBundle } from "../generators/northstar";
import { buildNorthstarGoldenTruth } from "../golden-truth/northstar";
import { validateCompanyBundle } from "../validators/consistency";
import type { GeneratedCompanyBundle } from "../schemas/types";

export const CORPUS_ROOT = join(
  process.cwd(),
  "company-factory",
  "corpus",
);

export function generateNorthstarBundle(
  seed?: number,
): GeneratedCompanyBundle {
  const profile = buildNorthstarGrowthSaasProfile(seed);
  const scenario = buildNorthstarScenario(profile);
  const golden = buildNorthstarGoldenTruth(profile, scenario);
  return assembleNorthstarBundle(profile, scenario, golden);
}

export function writeCompanyBundle(
  bundle: GeneratedCompanyBundle,
  root = CORPUS_ROOT,
): string {
  const dir = join(root, bundle.profile.companyId);
  mkdirSync(join(dir, "artifacts"), { recursive: true });

  writeFileSync(
    join(dir, "profile.json"),
    JSON.stringify(bundle.profile, null, 2),
  );
  writeFileSync(
    join(dir, "scenario.json"),
    JSON.stringify(bundle.scenario, null, 2),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(bundle.manifest, null, 2),
  );
  writeFileSync(
    join(dir, "golden-truth.json"),
    JSON.stringify(bundle.golden, null, 2),
  );

  for (const [rel, content] of bundle.files) {
    const path = join(dir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    if (typeof content === "string") {
      writeFileSync(path, content, "utf8");
    } else {
      writeFileSync(path, content);
    }
  }

  return dir;
}

export function generateVerticalSlice(): {
  dir: string;
  bundle: GeneratedCompanyBundle;
  validation: ReturnType<typeof validateCompanyBundle>;
} {
  const bundle = generateNorthstarBundle();
  const validation = validateCompanyBundle(bundle);
  if (!validation.ok) {
    const msg = validation.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.code}: ${i.message}`)
      .join("\n");
    throw new Error(`Factory validation failed for ${NORTHSTAR_COMPANY_ID}:\n${msg}`);
  }
  const dir = writeCompanyBundle(bundle);
  return { dir, bundle, validation };
}

export function corpusDirExists(): boolean {
  return existsSync(join(CORPUS_ROOT, NORTHSTAR_COMPANY_ID));
}
