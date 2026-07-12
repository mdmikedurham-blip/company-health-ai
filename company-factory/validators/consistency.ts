import type { GeneratedCompanyBundle } from "../schemas/types";
import { SYNTHETIC_DATA_CLASS, SYNTHETIC_ID_PREFIX } from "../schemas/types";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationReport = {
  ok: boolean;
  companyId: string;
  issues: ValidationIssue[];
};

/**
 * Cross-document / profile consistency. Fails generation if key values conflict.
 */
export function validateCompanyBundle(
  bundle: GeneratedCompanyBundle,
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const { profile, manifest, golden, files } = bundle;

  if (!profile.synthetic || profile.dataClass !== SYNTHETIC_DATA_CLASS) {
    issues.push({
      code: "not_synthetic",
      message: "Profile missing synthetic markers",
      severity: "error",
    });
  }
  if (!profile.companyId.startsWith(SYNTHETIC_ID_PREFIX)) {
    issues.push({
      code: "bad_id_prefix",
      message: `companyId must start with ${SYNTHETIC_ID_PREFIX}`,
      severity: "error",
    });
  }

  const banned = [/peachjar/i, /acme corp/i, /company-acme/i];
  const blob = JSON.stringify(profile) + JSON.stringify(manifest);
  for (const re of banned) {
    if (re.test(blob)) {
      issues.push({
        code: "production_reference",
        message: `Forbidden production/customer reference matched ${re}`,
        severity: "error",
      });
    }
  }

  if (manifest.artifacts.length < 12) {
    issues.push({
      code: "artifact_count",
      message: `Expected ≥12 artifacts, got ${manifest.artifacts.length}`,
      severity: "error",
    });
  }

  for (const art of manifest.artifacts) {
    if (!files.has(art.relativePath)) {
      issues.push({
        code: "missing_file",
        message: `Manifest lists ${art.relativePath} but file missing`,
        severity: "error",
      });
    }
  }

  const categories = new Set(manifest.artifacts.map((a) => a.category));
  for (const required of golden.expectedCoverage.requiredCategories) {
    if (!categories.has(required)) {
      issues.push({
        code: "missing_category",
        message: `Missing category ${required}`,
        severity: "error",
      });
    }
  }

  const qualities = new Set(manifest.artifacts.map((a) => a.quality));
  for (const q of ["strong", "average", "weak"] as const) {
    if (!qualities.has(q)) {
      issues.push({
        code: "quality_variant",
        message: `Corpus slice should include a ${q} artifact`,
        severity: "error",
      });
    }
  }

  // Runway consistency: cash / burn ≈ runway (within 15%)
  if (profile.monthlyBurn > 0) {
    const implied = profile.cash / profile.monthlyBurn;
    const rel = Math.abs(implied - profile.cashRunwayMonths) / implied;
    if (rel > 0.15) {
      issues.push({
        code: "runway_mismatch",
        message: `cash/burn (${implied.toFixed(1)}) disagrees with cashRunwayMonths (${profile.cashRunwayMonths})`,
        severity: "error",
      });
    }
  }

  // Customer export ARR should reconcile to profile ARR
  const cust = files.get("artifacts/04-customer-revenue.csv");
  if (typeof cust === "string") {
    const amounts = [...cust.matchAll(/,(\d+),active/g)].map((m) =>
      Number(m[1]),
    );
    const sum = amounts.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - profile.arr) > profile.arr * 0.02) {
      issues.push({
        code: "customer_arr_mismatch",
        message: `Customer export ARR sum ${sum} vs profile ${profile.arr}`,
        severity: "error",
      });
    }
  }

  // Roster headcount
  const roster = files.get("artifacts/12-employee-roster.csv");
  if (typeof roster === "string") {
    const people = roster.split("\n").filter((l) => /^E\d+/.test(l)).length;
    if (people !== profile.employeeCount) {
      issues.push({
        code: "headcount_mismatch",
        message: `Roster ${people} vs profile employeeCount ${profile.employeeCount}`,
        severity: "error",
      });
    }
  }

  // Board minutes should mention chair + ARR
  const minutes = files.get("artifacts/08-board-minutes.txt");
  if (typeof minutes === "string") {
    if (!minutes.includes(profile.boardStructure.chair)) {
      issues.push({
        code: "board_chair_mismatch",
        message: "Board minutes missing chair name from profile",
        severity: "error",
      });
    }
    if (!minutes.includes(String(profile.arr))) {
      issues.push({
        code: "board_arr_mismatch",
        message: "Board minutes ARR does not match profile",
        severity: "error",
      });
    }
  }

  // Idea-stage must not require board — Growth does have board (sanity)
  if (profile.lifecycleStage === "Idea") {
    const boardish = manifest.artifacts.filter((a) =>
      a.category === "governance" && a.title.toLowerCase().includes("board"),
    );
    if (boardish.some((a) => a.quality === "strong" && !a.title.includes("N/A"))) {
      // For idea stage we would warn — not applicable in this slice
    }
  }

  // Strong vs weak board artifacts must differ
  const strongBoard = files.get("artifacts/08-board-minutes.txt");
  const weakBoard = files.get("artifacts/09-board-consent-weak.txt");
  if (typeof strongBoard === "string" && typeof weakBoard === "string") {
    if (strongBoard.length < weakBoard.length * 1.2) {
      issues.push({
        code: "quality_not_distinct",
        message: "Strong board minutes should be materially richer than weak consent",
        severity: "warning",
      });
    }
    if (!/unanimous|Vote:/i.test(strongBoard)) {
      issues.push({
        code: "strong_board_incomplete",
        message: "Strong board minutes missing vote/approval language",
        severity: "error",
      });
    }
    if (!/unsigned|TBD|incomplete/i.test(weakBoard)) {
      issues.push({
        code: "weak_board_not_weak",
        message: "Weak consent should show incomplete/unsigned markers",
        severity: "error",
      });
    }
  }

  if (golden.lifecycleStage !== profile.lifecycleStage) {
    issues.push({
      code: "golden_stage_drift",
      message: "Golden truth stage diverges from profile",
      severity: "error",
    });
  }

  return {
    ok: issues.every((i) => i.severity !== "error"),
    companyId: profile.companyId,
    issues,
  };
}
