import { describe, expect, it } from "vitest";
import {
  buildNorthstarGrowthSaasProfile,
  buildNorthstarScenario,
  NORTHSTAR_SEED,
} from "../profiles/northstar-growth-saas";
import { assembleNorthstarBundle } from "../generators/northstar";
import { buildNorthstarGoldenTruth } from "../golden-truth/northstar";
import { validateCompanyBundle } from "../validators/consistency";
import { SYNTHETIC_ID_PREFIX } from "../schemas/types";

describe("company factory — Northstar vertical slice", () => {
  it("is deterministic from seed", () => {
    const a = buildNorthstarGrowthSaasProfile(NORTHSTAR_SEED);
    const b = buildNorthstarGrowthSaasProfile(NORTHSTAR_SEED);
    expect(a).toEqual(b);
    expect(a.companyId.startsWith(SYNTHETIC_ID_PREFIX)).toBe(true);
  });

  it("enforces cross-document consistency", () => {
    const profile = buildNorthstarGrowthSaasProfile();
    const scenario = buildNorthstarScenario(profile);
    const golden = buildNorthstarGoldenTruth(profile, scenario);
    const bundle = assembleNorthstarBundle(profile, scenario, golden);
    const report = validateCompanyBundle(bundle);
    expect(report.ok).toBe(true);
    expect(bundle.manifest.artifacts.length).toBeGreaterThanOrEqual(12);
  });

  it("includes strong/average/weak variants that differ materially", () => {
    const profile = buildNorthstarGrowthSaasProfile();
    const scenario = buildNorthstarScenario(profile);
    const golden = buildNorthstarGoldenTruth(profile, scenario);
    const bundle = assembleNorthstarBundle(profile, scenario, golden);
    const qualities = new Set(bundle.manifest.artifacts.map((a) => a.quality));
    expect(qualities.has("strong")).toBe(true);
    expect(qualities.has("average")).toBe(true);
    expect(qualities.has("weak")).toBe(true);
    const strong = String(bundle.files.get("artifacts/08-board-minutes.txt"));
    const weak = String(bundle.files.get("artifacts/09-board-consent-weak.txt"));
    expect(strong).toMatch(/Vote:|unanimous/i);
    expect(weak).toMatch(/unsigned|TBD|incomplete/i);
  });

  it("does not reference production customer data", () => {
    const profile = buildNorthstarGrowthSaasProfile();
    const scenario = buildNorthstarScenario(profile);
    const golden = buildNorthstarGoldenTruth(profile, scenario);
    const bundle = assembleNorthstarBundle(profile, scenario, golden);
    const blob = JSON.stringify(bundle.profile) + JSON.stringify(bundle.manifest);
    expect(blob).not.toMatch(/peachjar/i);
    expect(blob).not.toMatch(/company-acme/i);
  });

  it("fails validation when profile values are intentionally corrupted", () => {
    const profile = buildNorthstarGrowthSaasProfile();
    const scenario = buildNorthstarScenario(profile);
    const golden = buildNorthstarGoldenTruth(profile, scenario);
    const bundle = assembleNorthstarBundle(profile, scenario, golden);
    bundle.profile.cashRunwayMonths = 1;
    bundle.profile.monthlyBurn = 10;
    bundle.profile.cash = 10_000_000;
    const report = validateCompanyBundle(bundle);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "runway_mismatch")).toBe(true);
  });

  it("keeps golden truth independent of the insight engine", () => {
    // Golden builder must not import insight-engine (static contract via shape).
    const profile = buildNorthstarGrowthSaasProfile();
    const scenario = buildNorthstarScenario(profile);
    const golden = buildNorthstarGoldenTruth(profile, scenario);
    expect(golden.synthetic).toBe(true);
    expect(golden.financialHealth.expectedRange).toBeDefined();
    expect(golden.doctor.firstObservationContains.length).toBeGreaterThan(0);
  });

  it("marks Growth stage as board-applicable (not idea)", () => {
    const profile = buildNorthstarGrowthSaasProfile();
    expect(profile.lifecycleStage).toBe("Growth");
    expect(profile.lifecycleStage).not.toBe("Idea");
  });
});
