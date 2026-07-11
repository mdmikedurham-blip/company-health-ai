/**
 * Assessment Snapshot publish engine.
 *
 * Build pack → validate → publish (sync current tables) → supersede prior.
 * On failure after validation: leave previous current_snapshot_id intact.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  AssessmentSnapshotPack,
  AssessmentSnapshotRecord,
  DocumentVersionStamp,
} from "@/lib/domain/assessment-snapshot";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "@/lib/domain/diligence-question";
import type { BusinessConcept } from "@/lib/domain/business-concept";
import type {
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
} from "@/lib/domain";
import {
  replaceCompanyFindings,
  replaceCompanyRisks,
  replaceCompanyRecommendations,
  insertHealthScore,
} from "@/lib/supabase/repository";
import { replaceCompanyQuestionAnswers } from "@/lib/diligence/persist";
import { replaceCompanyBusinessConcepts } from "@/lib/concepts/persist";
import {
  buildAssessmentSnapshotPack,
  validateAssessmentSnapshotPack,
} from "./build-pack";
import { randomUUID } from "node:crypto";

export type PublishAssessmentSnapshotInput = {
  client: AppSupabaseClient;
  companyId: string;
  assessmentGoal?: AssessmentGoalId | string | null;
  companyStage?: CompanyLifecycleStage | string | null;
  generatedBy?: string;
  analysisVersion?: string;
  extractionVersion?: string;
  evidenceVersion?: string;
  documentVersions?: DocumentVersionStamp[];
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation;
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  questionAnswers?: DiligenceQuestionAnswer[];
  questionCoverage?: QuestionCoverageReport | null;
  businessConcepts?: BusinessConcept[];
  evidenceIds: string[];
  documentIds?: string[];
  /** When false, skip mutating normalized tables (pack-only publish). */
  syncCurrentTables?: boolean;
};

export type PublishAssessmentSnapshotResult = {
  snapshotId: string;
  pack: AssessmentSnapshotPack;
  previousSnapshotId: string | null;
  published: boolean;
};

function isMissingColumnError(message: string): boolean {
  return /does not exist|PGRST|schema cache|column/i.test(message);
}

async function getCurrentSnapshotId(
  client: AppSupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("companies")
    .select("current_snapshot_id")
    .eq("id", companyId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error.message)) return null;
    throw new Error(`getCurrentSnapshotId: ${error.message}`);
  }
  return (data as { current_snapshot_id?: string | null } | null)
    ?.current_snapshot_id ?? null;
}

async function setCurrentSnapshotId(
  client: AppSupabaseClient,
  companyId: string,
  snapshotId: string | null,
): Promise<void> {
  const { error } = await client
    .from("companies")
    .update({ current_snapshot_id: snapshotId })
    .eq("id", companyId);
  if (error && !isMissingColumnError(error.message)) {
    throw new Error(`setCurrentSnapshotId: ${error.message}`);
  }
}

async function markSuperseded(
  client: AppSupabaseClient,
  previousSnapshotId: string,
  newSnapshotId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("analysis_snapshots")
    .update({
      publish_kind: "superseded",
      superseded_at: now,
      superseded_by: newSnapshotId,
    })
    .eq("id", previousSnapshotId);
  if (error && !isMissingColumnError(error.message)) {
    throw new Error(`markSuperseded: ${error.message}`);
  }
}

async function markFailed(
  client: AppSupabaseClient,
  snapshotId: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("analysis_snapshots")
    .update({
      publish_kind: "failed",
      status: "failed",
      error_message: message.slice(0, 2000),
    })
    .eq("id", snapshotId);
  if (error && !isMissingColumnError(error.message)) {
    // Best-effort.
  }
}

/**
 * Publish a new assessment snapshot.
 * Never partially publishes: on sync failure, previous current pointer is restored.
 */
export async function publishAssessmentSnapshot(
  input: PublishAssessmentSnapshotInput,
): Promise<PublishAssessmentSnapshotResult> {
  const client = input.client;
  const companyId = input.companyId;
  const snapshotId = randomUUID();
  const createdAt = new Date().toISOString();
  const previousSnapshotId = await getCurrentSnapshotId(client, companyId);

  const pack = buildAssessmentSnapshotPack({
    snapshotId,
    companyId,
    assessmentGoal: input.assessmentGoal,
    companyStage: input.companyStage,
    createdAt,
    generatedBy: input.generatedBy,
    analysisVersion: input.analysisVersion,
    extractionVersion: input.extractionVersion,
    evidenceVersion: input.evidenceVersion,
    documentVersions: input.documentVersions,
    parentSnapshotId: previousSnapshotId,
    priorSnapshotId: previousSnapshotId,
    healthScore: input.healthScore,
    dimensions: input.dimensions,
    scoreChange: input.scoreChange,
    findings: input.findings,
    risks: input.risks,
    recommendations: input.recommendations,
    questionAnswers: (input.questionAnswers ?? []).map((a) => ({
      ...a,
      snapshotId,
    })),
    questionCoverage: input.questionCoverage
      ? { ...input.questionCoverage, snapshotId }
      : null,
    businessConcepts: (input.businessConcepts ?? []).map((c) => ({
      ...c,
      snapshotId,
    })),
    evidenceIds: input.evidenceIds,
    documentIds: input.documentIds,
  });

  const validation = validateAssessmentSnapshotPack(pack);
  if (!validation.ok) {
    throw new Error(
      `Assessment snapshot validation failed: ${validation.errors.join("; ")}`,
    );
  }

  // Insert draft/running row with full pack first (archive before mutating current tables).
  const insertPayload = {
    id: snapshotId,
    company_id: companyId,
    status: "running" as const,
    publish_kind: "draft",
    as_of: createdAt,
    assessment_goal: pack.assessmentGoal,
    company_stage: pack.companyStage,
    analysis_version: pack.analysisVersion,
    extraction_version: pack.extractionVersion,
    evidence_version: pack.evidenceVersion,
    document_versions: pack.documentVersions,
    generated_by: pack.generatedBy,
    confidence: pack.confidence,
    coverage_ratio: pack.coverageRatio,
    overall_health_available: pack.overallHealthAvailable,
    parent_snapshot_id: previousSnapshotId,
    payload: pack as unknown as import("@/lib/supabase").Json,
  };

  const { error: insertError } = await client
    .from("analysis_snapshots")
    .insert(insertPayload);

  if (insertError) {
    // Fallback for environments without Phase 6 columns yet.
    if (isMissingColumnError(insertError.message)) {
      const { error: legacyError } = await client
        .from("analysis_snapshots")
        .insert({
          id: snapshotId,
          company_id: companyId,
          status: "completed" as const,
          as_of: createdAt,
          payload: {
            ...pack,
            source: "assessment-snapshot-engine",
          } as unknown as import("@/lib/supabase").Json,
        });
      if (legacyError) {
        throw new Error(`publishAssessmentSnapshot.insert: ${legacyError.message}`);
      }
    } else {
      throw new Error(`publishAssessmentSnapshot.insert: ${insertError.message}`);
    }
  }

  const syncCurrent = input.syncCurrentTables !== false;

  try {
    if (syncCurrent) {
      await replaceCompanyFindings(client, companyId, pack.findings);
      await replaceCompanyRisks(client, companyId, pack.risks);
      await replaceCompanyRecommendations(
        client,
        companyId,
        pack.recommendations,
      );
      await insertHealthScore(
        client,
        companyId,
        pack.healthScore,
        pack.dimensions,
        pack.scoreChange,
        createdAt,
      );
      await replaceCompanyQuestionAnswers({
        client,
        companyId,
        answers: pack.questionAnswers,
        snapshotId,
      });
      await replaceCompanyBusinessConcepts({
        client,
        companyId,
        concepts: pack.businessConcepts,
        snapshotId,
      });
    }

    await setCurrentSnapshotId(client, companyId, snapshotId);

    const { error: publishError } = await client
      .from("analysis_snapshots")
      .update({
        status: "completed" as const,
        publish_kind: "published",
        published_at: new Date().toISOString(),
        payload: pack as unknown as import("@/lib/supabase").Json,
      })
      .eq("id", snapshotId);

    if (publishError && !isMissingColumnError(publishError.message)) {
      throw new Error(`publishAssessmentSnapshot.publish: ${publishError.message}`);
    }

    if (previousSnapshotId) {
      await markSuperseded(client, previousSnapshotId, snapshotId);
    }

    return {
      snapshotId,
      pack,
      previousSnapshotId,
      published: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Rollback pointer — never leave a half-published current snapshot.
    try {
      await setCurrentSnapshotId(client, companyId, previousSnapshotId);
    } catch {
      // ignore
    }
    await markFailed(client, snapshotId, message);
    throw new Error(`publishAssessmentSnapshot.rollback: ${message}`);
  }
}

export function rowToAssessmentSnapshotRecord(row: {
  id: string;
  company_id: string;
  status: string;
  publish_kind?: string | null;
  assessment_goal?: string | null;
  company_stage?: string | null;
  created_at: string;
  published_at?: string | null;
  analysis_version?: string | null;
  extraction_version?: string | null;
  evidence_version?: string | null;
  document_versions?: DocumentVersionStamp[] | null;
  generated_by?: string | null;
  confidence?: number | null;
  coverage_ratio?: number | null;
  overall_health_available?: boolean | null;
  parent_snapshot_id?: string | null;
  superseded_by?: string | null;
  payload?: unknown;
}): AssessmentSnapshotRecord {
  const pack =
    row.payload &&
    typeof row.payload === "object" &&
    (row.payload as { schemaVersion?: string }).schemaVersion ===
      "assessment-snapshot-pack-v1"
      ? (row.payload as AssessmentSnapshotPack)
      : null;

  return {
    snapshotId: row.id,
    companyId: row.company_id,
    publishKind: (row.publish_kind as AssessmentSnapshotRecord["publishKind"]) ?? "legacy",
    status: row.status as AssessmentSnapshotRecord["status"],
    assessmentGoal: row.assessment_goal ?? pack?.assessmentGoal ?? null,
    companyStage: row.company_stage ?? pack?.companyStage ?? null,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
    analysisVersion: row.analysis_version ?? pack?.analysisVersion ?? null,
    extractionVersion: row.extraction_version ?? pack?.extractionVersion ?? null,
    evidenceVersion: row.evidence_version ?? pack?.evidenceVersion ?? null,
    documentVersions: row.document_versions ?? pack?.documentVersions ?? [],
    generatedBy: row.generated_by ?? pack?.generatedBy ?? null,
    confidence: row.confidence ?? pack?.confidence ?? null,
    coverageRatio: row.coverage_ratio ?? pack?.coverageRatio ?? null,
    overallHealthAvailable:
      row.overall_health_available ?? pack?.overallHealthAvailable ?? false,
    parentSnapshotId: row.parent_snapshot_id ?? null,
    supersededBy: row.superseded_by ?? null,
    pack,
  };
}

export async function getCurrentAssessmentSnapshot(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<AssessmentSnapshotRecord | null> {
  const currentId = await getCurrentSnapshotId(input.client, input.companyId);
  if (currentId) {
    const { data, error } = await input.client
      .from("analysis_snapshots")
      .select("*")
      .eq("id", currentId)
      .maybeSingle();
    if (error) throw new Error(`getCurrentAssessmentSnapshot: ${error.message}`);
    if (data) return rowToAssessmentSnapshotRecord(data as never);
  }

  // Fallback: latest completed snapshot for this company.
  const { data, error } = await input.client
    .from("analysis_snapshots")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getCurrentAssessmentSnapshot.fallback: ${error.message}`);
  if (!data) return null;
  return rowToAssessmentSnapshotRecord(data as never);
}

export async function listHistoricalAssessmentSnapshots(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
}): Promise<AssessmentSnapshotRecord[]> {
  const limit = input.limit ?? 20;
  const { data, error } = await input.client
    .from("analysis_snapshots")
    .select("*")
    .eq("company_id", input.companyId)
    .in("status", ["completed", "failed"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`listHistoricalAssessmentSnapshots: ${error.message}`);
  }
  return (data ?? []).map((row) => rowToAssessmentSnapshotRecord(row as never));
}

export async function getAssessmentSnapshotById(input: {
  client: AppSupabaseClient;
  companyId: string;
  snapshotId: string;
}): Promise<AssessmentSnapshotRecord | null> {
  const { data, error } = await input.client
    .from("analysis_snapshots")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("id", input.snapshotId)
    .maybeSingle();
  if (error) throw new Error(`getAssessmentSnapshotById: ${error.message}`);
  if (!data) return null;
  return rowToAssessmentSnapshotRecord(data as never);
}

/**
 * Historical snapshots are immutable — reject pack mutations on published/superseded.
 */
export function assertSnapshotImmutable(
  record: AssessmentSnapshotRecord,
): void {
  if (record.publishKind === "published" || record.publishKind === "superseded") {
    throw new Error(
      `Snapshot ${record.snapshotId} is ${record.publishKind} and immutable`,
    );
  }
}
