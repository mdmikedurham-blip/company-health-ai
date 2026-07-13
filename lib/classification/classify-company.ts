/**
 * Infer company lifecycle stage and profile fields from persisted evidence only.
 * No demo data, no hardcoded company names.
 */

import type { Evidence } from "@/lib/domain";
import type {
  ClassificationAssumption,
  CompanyLifecycleStage,
  ConfirmedClassificationOverrides,
  CustomerCountRange,
  EmployeeCountRange,
  FundingStatus,
  InferredClassificationFields,
  ProfileFieldProvenance,
  RevenueRange,
  SecurityMaturityExpected,
} from "@/lib/domain/company-classification";
import { asNumber, asRatio } from "@/lib/intelligence/rules";
import {
  expectationsForStage,
  isDimensionRelevantForStage,
} from "./expectation-matrix";
import type { DocumentClassId, ExpectationItem } from "@/lib/domain/company-classification";

function textBlob(evidence: Evidence[]): string {
  return evidence
    .map((e) =>
      [e.title, e.contentSummary, e.sourceType, JSON.stringify(e.extractedFacts)].join(
        " ",
      ),
    )
    .join("\n")
    .toLowerCase();
}

function maxRevenue(evidence: Evidence[]): number | null {
  let max: number | null = null;
  for (const e of evidence) {
    const r = asNumber(e.extractedFacts.revenue);
    if (r != null && (max === null || r > max)) max = r;
  }
  return max;
}

function hasFinancialFacts(evidence: Evidence[]): boolean {
  return evidence.some(
    (e) =>
      asNumber(e.extractedFacts.revenue) != null ||
      asNumber(e.extractedFacts.cashBalance) != null ||
      asNumber(e.extractedFacts.cashRunwayMonths) != null ||
      asNumber(e.extractedFacts.ebitda) != null ||
      asNumber(e.extractedFacts.burnRateMonthly) != null ||
      e.extractedFacts.financialFactsComplete === true,
  );
}

function hasCustomerMetrics(evidence: Evidence[]): boolean {
  return evidence.some(
    (e) =>
      asRatio(e.extractedFacts.top3CustomerArrShare) != null ||
      asRatio(e.extractedFacts.netRevenueRetention) != null ||
      asRatio(e.extractedFacts.churnRate) != null ||
      asRatio(e.extractedFacts.recurringRevenueShare) != null,
  );
}

function hasGovernanceFacts(evidence: Evidence[]): boolean {
  return evidence.some(
    (e) =>
      e.extractedFacts.boardApprovalsDocumented === true ||
      e.extractedFacts.directorElectionsDocumented === true ||
      e.extractedFacts.writtenConsentDocumented === true ||
      typeof e.extractedFacts.boardMeetingDate === "string" ||
      e.dimensionId === "dim-governance",
  );
}

function detectOutsideInvestors(blob: string, evidence: Evidence[]): boolean {
  if (
    /\b(series\s+[a-c]|seed\s+round|venture|outside\s+investor|term\s+sheet|priced\s+round)\b/i.test(
      blob,
    )
  ) {
    return true;
  }
  return evidence.some(
    (e) =>
      e.extractedFacts.financingApprovalsDocumented === true ||
      e.sourceType === "fundraising",
  );
}

function detectExitReady(blob: string): boolean {
  return /\b(ipo|s-1|acquisition|exit\s+ready|sell[- ]side|due\s+diligence\s+data\s+room)\b/i.test(
    blob,
  );
}

function revenueRangeFromAmount(revenue: number | null, hasFin: boolean): RevenueRange {
  if (revenue == null) return hasFin ? "unknown" : "pre-revenue";
  if (revenue <= 0) return "none";
  if (revenue < 1_000_000) return "under-1m";
  if (revenue < 10_000_000) return "1m-10m";
  return "10m-plus";
}

function inferStage(input: {
  revenue: number | null;
  hasFin: boolean;
  hasCustomers: boolean;
  hasGov: boolean;
  outsideInvestors: boolean;
  exitReady: boolean;
  evidenceCount: number;
  blob: string;
}): { stage: CompanyLifecycleStage; rationale: string; confidence: number } {
  if (input.exitReady) {
    return {
      stage: "Exit Ready",
      rationale:
        "Documents reference acquisition, IPO, or formal exit preparation.",
      confidence: 72,
    };
  }

  const revenue = input.revenue;
  if (revenue != null && revenue >= 10_000_000 && input.outsideInvestors) {
    return {
      stage: "Scale",
      rationale:
        "Revenue at or above $10M with outside investor signals and control expectations.",
      confidence: 70,
    };
  }

  if (
    (revenue != null && revenue >= 1_000_000) ||
    (input.outsideInvestors && input.hasGov && input.hasFin)
  ) {
    return {
      stage: "Growth",
      rationale:
        revenue != null && revenue >= 1_000_000
          ? "Revenue in the $1M–$10M+ band with operating evidence."
          : "Outside investors plus governance and financial evidence indicate Growth.",
      confidence: 68,
    };
  }

  if (input.hasCustomers && input.hasFin && (revenue == null || revenue < 1_000_000)) {
    const retention =
      /\b(retention|nrr|repeatable|product[- ]market\s+fit|pmf)\b/i.test(input.blob);
    if (retention || (input.hasCustomers && revenue != null && revenue > 100_000)) {
      return {
        stage: "Product-Market Fit",
        rationale:
          "Repeatable revenue/customer metrics present below the $1M–$10M Growth band.",
        confidence: 64,
      };
    }
  }

  if (input.hasFin || input.hasCustomers || (revenue != null && revenue > 0)) {
    return {
      stage: "Early Revenue",
      rationale:
        "Financial or first-customer evidence present without clear PMF/Growth signals.",
      confidence: 62,
    };
  }

  if (
    input.evidenceCount > 0 &&
    /\b(mvp|prototype|product\s+spec|roadmap|pitch)\b/i.test(input.blob)
  ) {
    return {
      stage: "Pre-product / MVP",
      rationale: "Founder/product documents without meaningful revenue evidence.",
      confidence: 58,
    };
  }

  if (input.evidenceCount > 0) {
    return {
      stage: "Idea",
      rationale:
        "Limited evidence (founder-oriented) with no revenue or customer metrics.",
      confidence: 55,
    };
  }

  return {
    stage: "Idea",
    rationale: "No persisted evidence yet — defaulting to Idea until documents arrive.",
    confidence: 20,
  };
}

function employeeCountFromEvidence(evidence: Evidence[]): number | null {
  let best: number | null = null;
  for (const e of evidence) {
    const n = asNumber(e.extractedFacts.employeeCount);
    if (n == null || n <= 0) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

function employeeRangeFromCount(n: number): EmployeeCountRange {
  if (n <= 5) return "1-5";
  if (n <= 20) return "6-20";
  if (n <= 50) return "21-50";
  if (n <= 200) return "51-200";
  return "200-plus";
}

function inferEmployeeRange(
  evidence: Evidence[],
  blob: string,
): EmployeeCountRange {
  const fromFacts = employeeCountFromEvidence(evidence);
  if (fromFacts != null) return employeeRangeFromCount(fromFacts);

  const m = /\b(\d{1,4})\s+(?:employees?|ftes?|team\s+members?)\b/i.exec(blob);
  if (!m?.[1]) return "unknown";
  return employeeRangeFromCount(Number(m[1]));
}

function inferCustomerRange(evidence: Evidence[], blob: string): CustomerCountRange {
  const m = /\b(\d{1,5})\s+(?:customers?|accounts?)\b/i.exec(blob);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (n <= 0) return "none";
    if (n <= 10) return "1-10";
    if (n <= 50) return "11-50";
    if (n <= 200) return "51-200";
    return "200-plus";
  }
  if (hasCustomerMetrics(evidence)) return "1-10";
  return "unknown";
}

function inferFunding(blob: string, outside: boolean): FundingStatus {
  if (/\bseries\s+[b-z]\b/i.test(blob)) return "series-a-plus";
  if (/\bseries\s+a\b/i.test(blob)) return "series-a-plus";
  if (/\bseed\b/i.test(blob)) return "seed";
  if (/\bpre[- ]?seed\b/i.test(blob)) return "pre-seed";
  if (/\bfriends\s*(and|&)\s*family\b/i.test(blob)) return "friends-family";
  if (outside) return "seed";
  if (/\bbootstrapped|self[- ]funded\b/i.test(blob)) return "bootstrapped";
  return "unknown";
}

function detectDocumentClasses(evidence: Evidence[]): Set<DocumentClassId> {
  const found = new Set<DocumentClassId>();
  for (const e of evidence) {
    const t = `${e.title} ${e.sourceType} ${e.contentSummary}`.toLowerCase();
    const facts = e.extractedFacts;
    if (/\b(articles|certificate of incorporation|founder|operating agreement)\b/.test(t)) {
      found.add("founder-docs");
    }
    if (/\b(mvp|product spec|roadmap|prd)\b/.test(t)) found.add("product-spec");
    if (facts.financialFactsComplete === true || asNumber(facts.revenue) != null) {
      found.add("financial-statements");
    }
    if (
      asNumber(facts.ebitda) != null ||
      asNumber(facts.cashBalance) != null ||
      asNumber(facts.burnRateMonthly) != null
    ) {
      found.add("financial-statements");
    }
    if (/\b(model|forecast|projection)\b/.test(t)) found.add("financial-model");
    if (
      asRatio(facts.top3CustomerArrShare) != null ||
      asRatio(facts.netRevenueRetention) != null ||
      asRatio(facts.churnRate) != null ||
      asRatio(facts.recurringRevenueShare) != null ||
      /\btraction|customers?\b/.test(t)
    ) {
      found.add("customer-traction");
    }
    if (/\b(msa|customer contract|sow)\b/.test(t)) found.add("customer-contracts");
    if (/\bcap\s*table|ownership\b/.test(t)) found.add("cap-table");
    if (
      facts.boardApprovalsDocumented === true ||
      /\bboard minutes|written consent\b/.test(t)
    ) {
      found.add("board-minutes");
    }
    if (
      asNumber(facts.agreementsMissingIpAssignment) != null ||
      /\b(employment|ip assignment|contractor)\b/.test(t)
    ) {
      found.add("employment-ip");
    }
    if (
      asRatio(facts.mfaCoverage) != null ||
      asNumber(facts.openCriticalControls) != null ||
      /\bsecurity|mfa|soc\b/.test(t)
    ) {
      found.add("security-controls");
    }
    if (/\baudit|soc\s*2|attestation\b/.test(t)) found.add("audit-report");
    if (/\b(term sheet|series|investor|fundraising)\b/.test(t)) {
      found.add("fundraising");
    }
  }
  return found;
}

function provenance(
  field: string,
  value: string | number | boolean | null,
  evidenceIds: string[],
  source: string,
  confidence: number,
  now: string,
): ProfileFieldProvenance {
  return {
    value,
    evidenceIds,
    extractionSource: source,
    confidence,
    origin: "inferred",
    updatedAt: now,
  };
}

export type ClassifyCompanyResult = {
  inferred: InferredClassificationFields;
  effective: InferredClassificationFields;
  stage: CompanyLifecycleStage;
  confidence: number;
  rationale: string;
  assumptions: ClassificationAssumption[];
  fieldProvenance: Record<string, ProfileFieldProvenance>;
  sourceEvidenceIds: string[];
  evidenceCoveragePct: number;
  dimensionCoverage: Record<string, number>;
  missingRequired: ExpectationItem[];
  missingRecommended: ExpectationItem[];
  optionalRemaining: ExpectationItem[];
  healthScoreAvailable: boolean;
};

export function applyConfirmedOverrides(
  inferred: InferredClassificationFields,
  confirmed: ConfirmedClassificationOverrides,
): InferredClassificationFields {
  return {
    ...inferred,
    stage: confirmed.stage ?? inferred.stage,
    annualRevenueRange:
      confirmed.annualRevenueRange ?? inferred.annualRevenueRange,
    employeeCountRange:
      confirmed.employeeCountRange ?? inferred.employeeCountRange,
    boardPresent:
      confirmed.boardPresent !== undefined
        ? confirmed.boardPresent
        : inferred.boardPresent,
    fundingStatus: confirmed.fundingStatus ?? inferred.fundingStatus,
  };
}

/**
 * Classify from persisted evidence. Pass prior confirmed overrides to preserve them.
 */
export function classifyCompanyFromEvidence(input: {
  evidence: Evidence[];
  confirmed?: ConfirmedClassificationOverrides;
  scoredDimensionIds?: string[];
  generatedAt?: string;
}): ClassifyCompanyResult {
  const now = input.generatedAt ?? new Date().toISOString();
  const evidence = input.evidence;
  const blob = textBlob(evidence);
  const revenue = maxRevenue(evidence);
  const hasFin = hasFinancialFacts(evidence);
  const hasCustomers = hasCustomerMetrics(evidence);
  const hasGov = hasGovernanceFacts(evidence);
  const outsideInvestors = detectOutsideInvestors(blob, evidence);
  const exitReady = detectExitReady(blob);
  const evidenceIds = evidence.map((e) => e.id);

  const { stage, rationale, confidence } = inferStage({
    revenue,
    hasFin,
    hasCustomers,
    hasGov,
    outsideInvestors,
    exitReady,
    evidenceCount: evidence.length,
    blob,
  });

  const annualRevenueRange = revenueRangeFromAmount(revenue, hasFin);
  const employeeCountRange = inferEmployeeRange(evidence, blob);
  const customerCountRange = inferCustomerRange(evidence, blob);
  const fundingStatus = inferFunding(blob, outsideInvestors);

  const boardRequired =
    stage === "Growth" ||
    stage === "Scale" ||
    stage === "Exit Ready" ||
    (outsideInvestors && stage !== "Idea" && stage !== "Pre-product / MVP");

  const boardPresent = hasGov
    ? true
    : boardRequired
      ? false
      : null;

  const auditExpected =
    stage === "Scale" || stage === "Exit Ready"
      ? true
      : stage === "Growth"
        ? true
        : false;

  const securityMaturityExpected: SecurityMaturityExpected =
    stage === "Exit Ready" || stage === "Scale"
      ? "enterprise"
      : stage === "Growth" || stage === "Product-Market Fit"
        ? "formal"
        : stage === "Early Revenue"
          ? "growing"
          : "basic";

  const industry = /\b(saas|software|b2b)\b/i.test(blob)
    ? "B2B software"
    : null;
  const businessModel = /\bsaas|subscription\b/i.test(blob)
    ? "SaaS"
    : /\bmarketplace\b/i.test(blob)
      ? "Marketplace"
      : null;
  const revenueModel =
    asRatio(evidence[0]?.extractedFacts.recurringRevenueShare) != null ||
    /\brecurring|subscription\b/i.test(blob)
      ? "Recurring / subscription"
      : hasFin
        ? "Unknown mix"
        : null;

  const inferred: InferredClassificationFields = {
    stage,
    industry,
    businessModel,
    revenueModel,
    annualRevenueRange,
    employeeCountRange,
    customerCountRange,
    fundingStatus,
    outsideInvestors: outsideInvestors || null,
    jurisdictionEntityType: /\b(delaware|c-corp|llc)\b/i.test(blob)
      ? blob.match(/\b(delaware c-corp|c-corp|llc)\b/i)?.[1] ?? null
      : null,
    boardRequired,
    boardPresent,
    auditExpected,
    securityMaturityExpected,
  };

  const confirmed = input.confirmed ?? {};
  const effective = applyConfirmedOverrides(inferred, confirmed);
  const effectiveStage = effective.stage ?? stage;

  const fieldProvenance: Record<string, ProfileFieldProvenance> = {
    stage: provenance(
      "stage",
      effectiveStage,
      evidenceIds,
      "evidence-inference",
      confidence,
      now,
    ),
    annualRevenueRange: provenance(
      "annualRevenueRange",
      effective.annualRevenueRange,
      evidence.filter((e) => asNumber(e.extractedFacts.revenue) != null).map((e) => e.id),
      "financial-facts",
      hasFin ? 70 : 30,
      now,
    ),
    employeeCountRange: provenance(
      "employeeCountRange",
      effective.employeeCountRange,
      evidenceIds,
      "document-text",
      effective.employeeCountRange === "unknown" ? 20 : 55,
      now,
    ),
    fundingStatus: provenance(
      "fundingStatus",
      effective.fundingStatus,
      evidenceIds,
      "document-text",
      effective.fundingStatus === "unknown" ? 25 : 60,
      now,
    ),
    boardPresent: provenance(
      "boardPresent",
      effective.boardPresent,
      evidence.filter((e) => e.dimensionId === "dim-governance").map((e) => e.id),
      "governance-facts",
      hasGov ? 65 : 35,
      now,
    ),
  };

  // Mark confirmed origins
  for (const key of Object.keys(confirmed) as (keyof ConfirmedClassificationOverrides)[]) {
    if (confirmed[key] === undefined || !fieldProvenance[key]) continue;
    fieldProvenance[key] = {
      ...fieldProvenance[key]!,
      value: confirmed[key] as string | number | boolean,
      origin: "user-confirmed",
      extractionSource: "user-confirmation",
      confidence: 100,
      updatedAt: now,
    };
  }

  const assumptions: ClassificationAssumption[] = [];
  if (!confirmed.stage) {
    assumptions.push({
      field: "stage",
      statement: `Stage inferred as ${effectiveStage}. Confirm if incorrect.`,
      requiresConfirmation: true,
    });
  }
  if (effective.employeeCountRange === "unknown") {
    assumptions.push({
      field: "employeeCountRange",
      statement: "Employee count was not found in evidence.",
      requiresConfirmation: true,
    });
  }
  if (effective.boardPresent == null && boardRequired) {
    assumptions.push({
      field: "boardPresent",
      statement: "Board is expected at this stage but presence is unconfirmed.",
      requiresConfirmation: true,
    });
  }
  if (effective.fundingStatus === "unknown") {
    assumptions.push({
      field: "fundingStatus",
      statement: "Funding status could not be determined from documents.",
      requiresConfirmation: true,
    });
  }

  const present = detectDocumentClasses(evidence);
  const expectations = expectationsForStage(effectiveStage);
  const missingRequired = expectations.filter(
    (e) => e.level === "required" && !present.has(e.documentClass),
  );
  const missingRecommended = expectations.filter(
    (e) => e.level === "recommended" && !present.has(e.documentClass),
  );
  const optionalRemaining = expectations.filter(
    (e) => e.level === "optional" && !present.has(e.documentClass),
  );

  const applicable = expectations.filter((e) => e.level !== "not_applicable");
  const satisfied = applicable.filter((e) => present.has(e.documentClass));
  const evidenceCoveragePct =
    applicable.length === 0
      ? 0
      : Math.round((satisfied.length / applicable.length) * 1000) / 10;

  const dimensionCoverage: Record<string, number> = {};
  const dims = new Set(applicable.map((e) => e.dimensionId));
  for (const dim of dims) {
    const needed = applicable.filter((e) => e.dimensionId === dim);
    const have = needed.filter((e) => present.has(e.documentClass));
    dimensionCoverage[dim] =
      needed.length === 0
        ? 0
        : Math.round((have.length / needed.length) * 1000) / 10;
  }

  const scored = new Set(input.scoredDimensionIds ?? []);
  const relevantDims = expectations
    .map((e) => e.dimensionId)
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .filter((id) => isDimensionRelevantForStage(effectiveStage, id));
  const scoredRelevant = relevantDims.filter((id) => scored.has(id));
  // Overall health needs classification + ≥2 scored relevant dimensions.
  const healthScoreAvailable =
    evidence.length > 0 && scoredRelevant.length >= 2;

  return {
    inferred,
    effective,
    stage: effectiveStage,
    confidence: confirmed.stage ? Math.max(confidence, 85) : confidence,
    rationale,
    assumptions,
    fieldProvenance,
    sourceEvidenceIds: evidenceIds,
    evidenceCoveragePct,
    dimensionCoverage,
    missingRequired,
    missingRecommended,
    optionalRemaining,
    healthScoreAvailable,
  };
}
