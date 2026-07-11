/**
 * Persist / load company_classifications. Confirmed overrides are never
 * cleared by re-inference.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  CompanyClassification,
  ConfirmedClassificationOverrides,
  InferredClassificationFields,
  ProfileFieldProvenance,
  ExpectationItem,
  ClassificationAssumption,
  CompanyLifecycleStage,
  RevenueRange,
  EmployeeCountRange,
  CustomerCountRange,
  FundingStatus,
  SecurityMaturityExpected,
} from "@/lib/domain/company-classification";
import type { ClassifyCompanyResult } from "@/lib/classification";
import type { Json } from "@/lib/supabase/database.types";

type ClassificationRow = {
  id: string;
  company_id: string;
  snapshot_id: string | null;
  stage: string | null;
  industry: string | null;
  business_model: string | null;
  revenue_model: string | null;
  annual_revenue_range: string | null;
  employee_count_range: string | null;
  customer_count_range: string | null;
  funding_status: string | null;
  outside_investors: boolean | null;
  jurisdiction_entity_type: string | null;
  board_required: boolean | null;
  board_present: boolean | null;
  audit_expected: boolean | null;
  security_maturity_expected: string | null;
  confidence: number;
  source_evidence_ids: string[];
  generated_at: string;
  field_provenance: Json;
  inferred: Json;
  inference_rationale: string | null;
  assumptions: Json;
  confirmed: Json;
  confirmed_at: string | null;
  confirmed_by: string | null;
  evidence_coverage_pct: number;
  dimension_coverage: Json;
  missing_required: Json;
  missing_recommended: Json;
  optional_remaining: Json;
  health_score_available: boolean;
  created_at: string;
  updated_at: string;
};

function asJson(value: unknown): Json {
  return value as Json;
}

export function classificationFromRow(row: ClassificationRow): CompanyClassification {
  return {
    id: row.id,
    companyId: row.company_id,
    snapshotId: row.snapshot_id,
    stage: row.stage as CompanyLifecycleStage | null,
    industry: row.industry,
    businessModel: row.business_model,
    revenueModel: row.revenue_model,
    annualRevenueRange: (row.annual_revenue_range as RevenueRange) ?? "unknown",
    employeeCountRange: (row.employee_count_range as EmployeeCountRange) ?? "unknown",
    customerCountRange: (row.customer_count_range as CustomerCountRange) ?? "unknown",
    fundingStatus: (row.funding_status as FundingStatus) ?? "unknown",
    outsideInvestors: row.outside_investors,
    jurisdictionEntityType: row.jurisdiction_entity_type,
    boardRequired: row.board_required,
    boardPresent: row.board_present,
    auditExpected: row.audit_expected,
    securityMaturityExpected:
      (row.security_maturity_expected as SecurityMaturityExpected) ?? null,
    confidence: Number(row.confidence),
    sourceEvidenceIds: row.source_evidence_ids ?? [],
    generatedAt: row.generated_at,
    fieldProvenance: (row.field_provenance ?? {}) as Record<
      string,
      ProfileFieldProvenance
    >,
    inferred: (row.inferred ?? {}) as InferredClassificationFields,
    inferenceRationale: row.inference_rationale ?? "",
    assumptions: (row.assumptions ?? []) as ClassificationAssumption[],
    confirmed: (row.confirmed ?? {}) as ConfirmedClassificationOverrides,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    evidenceCoveragePct: Number(row.evidence_coverage_pct),
    dimensionCoverage: (row.dimension_coverage ?? {}) as Record<string, number>,
    missingRequired: (row.missing_required ?? []) as ExpectationItem[],
    missingRecommended: (row.missing_recommended ?? []) as ExpectationItem[],
    optionalRemaining: (row.optional_remaining ?? []) as ExpectationItem[],
    healthScoreAvailable: row.health_score_available,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCompanyClassification(
  client: AppSupabaseClient,
  companyId: string,
): Promise<CompanyClassification | null> {
  const { data, error } = await client
    .from("company_classifications")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(`getCompanyClassification: ${error.message}`);
  return data ? classificationFromRow(data as ClassificationRow) : null;
}

export async function upsertCompanyClassificationFromResult(input: {
  client: AppSupabaseClient;
  companyId: string;
  snapshotId: string | null;
  result: ClassifyCompanyResult;
  /** Existing confirmed overrides — preserved. */
  priorConfirmed?: ConfirmedClassificationOverrides;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}): Promise<CompanyClassification> {
  const confirmed = input.priorConfirmed ?? {};
  const eff = input.result.effective;
  const row = {
    company_id: input.companyId,
    snapshot_id: input.snapshotId,
    stage: eff.stage,
    industry: eff.industry,
    business_model: eff.businessModel,
    revenue_model: eff.revenueModel,
    annual_revenue_range: eff.annualRevenueRange,
    employee_count_range: eff.employeeCountRange,
    customer_count_range: eff.customerCountRange,
    funding_status: eff.fundingStatus,
    outside_investors: eff.outsideInvestors,
    jurisdiction_entity_type: eff.jurisdictionEntityType,
    board_required: eff.boardRequired,
    board_present: eff.boardPresent,
    audit_expected: eff.auditExpected,
    security_maturity_expected: eff.securityMaturityExpected,
    confidence: input.result.confidence,
    source_evidence_ids: input.result.sourceEvidenceIds,
    generated_at: new Date().toISOString(),
    field_provenance: asJson(input.result.fieldProvenance),
    inferred: asJson(input.result.inferred),
    inference_rationale: input.result.rationale,
    assumptions: asJson(input.result.assumptions),
    confirmed: asJson(confirmed),
    confirmed_at: input.confirmedAt ?? null,
    confirmed_by: input.confirmedBy ?? null,
    evidence_coverage_pct: input.result.evidenceCoveragePct,
    dimension_coverage: asJson(input.result.dimensionCoverage),
    missing_required: asJson(input.result.missingRequired),
    missing_recommended: asJson(input.result.missingRecommended),
    optional_remaining: asJson(input.result.optionalRemaining),
    health_score_available: input.result.healthScoreAvailable,
  };

  const { data, error } = await input.client
    .from("company_classifications")
    .upsert(row, { onConflict: "company_id" })
    .select("*")
    .single();
  if (error) {
    throw new Error(`upsertCompanyClassification: ${error.message}`);
  }
  return classificationFromRow(data as ClassificationRow);
}

/**
 * Merge user confirmations into confirmed jsonb without clearing other keys.
 * Does not overwrite inferred blob — only confirmed + effective display fields.
 */
export async function confirmCompanyClassificationFields(input: {
  client: AppSupabaseClient;
  companyId: string;
  userId: string;
  overrides: ConfirmedClassificationOverrides;
}): Promise<CompanyClassification> {
  const existing = await getCompanyClassification(input.client, input.companyId);
  const prior = existing?.confirmed ?? {};
  const nextConfirmed: ConfirmedClassificationOverrides = {
    ...prior,
    ...input.overrides,
  };

  // Re-apply overrides onto last inferred values.
  const inferred = (existing?.inferred ?? {
    stage: existing?.stage ?? null,
    industry: existing?.industry ?? null,
    businessModel: existing?.businessModel ?? null,
    revenueModel: existing?.revenueModel ?? null,
    annualRevenueRange: existing?.annualRevenueRange ?? "unknown",
    employeeCountRange: existing?.employeeCountRange ?? "unknown",
    customerCountRange: existing?.customerCountRange ?? "unknown",
    fundingStatus: existing?.fundingStatus ?? "unknown",
    outsideInvestors: existing?.outsideInvestors ?? null,
    jurisdictionEntityType: existing?.jurisdictionEntityType ?? null,
    boardRequired: existing?.boardRequired ?? null,
    boardPresent: existing?.boardPresent ?? null,
    auditExpected: existing?.auditExpected ?? null,
    securityMaturityExpected: existing?.securityMaturityExpected ?? null,
  }) as InferredClassificationFields;

  const { applyConfirmedOverrides } = await import("@/lib/classification");
  const effective = applyConfirmedOverrides(inferred, nextConfirmed);
  const now = new Date().toISOString();

  const provenance = {
    ...(existing?.fieldProvenance ?? {}),
  } as Record<string, ProfileFieldProvenance>;
  for (const key of Object.keys(input.overrides) as (keyof ConfirmedClassificationOverrides)[]) {
    if (input.overrides[key] === undefined) continue;
    provenance[key] = {
      value: input.overrides[key] as string | number | boolean,
      evidenceIds: existing?.sourceEvidenceIds ?? [],
      extractionSource: "user-confirmation",
      confidence: 100,
      origin: "user-confirmed",
      updatedAt: now,
    };
  }

  const { data, error } = await input.client
    .from("company_classifications")
    .upsert(
      {
        company_id: input.companyId,
        snapshot_id: existing?.snapshotId ?? null,
        stage: effective.stage,
        industry: effective.industry,
        business_model: effective.businessModel,
        revenue_model: effective.revenueModel,
        annual_revenue_range: effective.annualRevenueRange,
        employee_count_range: effective.employeeCountRange,
        customer_count_range: effective.customerCountRange,
        funding_status: effective.fundingStatus,
        outside_investors: effective.outsideInvestors,
        jurisdiction_entity_type: effective.jurisdictionEntityType,
        board_required: effective.boardRequired,
        board_present: effective.boardPresent,
        audit_expected: effective.auditExpected,
        security_maturity_expected: effective.securityMaturityExpected,
        confidence: Math.max(existing?.confidence ?? 0, 85),
        source_evidence_ids: existing?.sourceEvidenceIds ?? [],
        generated_at: existing?.generatedAt ?? now,
        field_provenance: asJson(provenance),
        inferred: asJson(inferred),
        inference_rationale: existing?.inferenceRationale ?? "",
        assumptions: asJson(
          (existing?.assumptions ?? []).filter(
            (a) =>
              !(
                Object.keys(input.overrides) as string[]
              ).includes(a.field),
          ),
        ),
        confirmed: asJson(nextConfirmed),
        confirmed_at: now,
        confirmed_by: input.userId,
        evidence_coverage_pct: existing?.evidenceCoveragePct ?? 0,
        dimension_coverage: asJson(existing?.dimensionCoverage ?? {}),
        missing_required: asJson(existing?.missingRequired ?? []),
        missing_recommended: asJson(existing?.missingRecommended ?? []),
        optional_remaining: asJson(existing?.optionalRemaining ?? []),
        health_score_available: existing?.healthScoreAvailable ?? false,
      },
      { onConflict: "company_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`confirmCompanyClassificationFields: ${error.message}`);
  }
  return classificationFromRow(data as ClassificationRow);
}
