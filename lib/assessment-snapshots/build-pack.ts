/**
 * Build an immutable Assessment Snapshot pack from engine output.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { BusinessConcept } from "@/lib/domain/business-concept";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "@/lib/domain/diligence-question";
import type {
  AssessmentSnapshotPack,
  DocumentVersionStamp,
} from "@/lib/domain/assessment-snapshot";
import type {
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
} from "@/lib/domain";
import {
  CURRENT_ANALYSIS_VERSION,
  CURRENT_EXTRACTION_VERSION,
} from "@/lib/uploads/versions";

export const ASSESSMENT_SNAPSHOT_PACK_VERSION = "assessment-snapshot-pack-v1" as const;

export function buildAssessmentSnapshotPack(input: {
  snapshotId: string;
  companyId: string;
  assessmentGoal?: AssessmentGoalId | string | null;
  companyStage?: CompanyLifecycleStage | string | null;
  createdAt?: string;
  generatedBy?: string;
  analysisVersion?: string;
  extractionVersion?: string;
  evidenceVersion?: string;
  documentVersions?: DocumentVersionStamp[];
  parentSnapshotId?: string | null;
  priorSnapshotId?: string | null;
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
}): AssessmentSnapshotPack {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const coverageRatio = input.questionCoverage?.coverageRatio ?? 0;
  const confidence =
    input.questionCoverage?.meanConfidence ??
    input.healthScore.confidence ??
    0;

  return {
    schemaVersion: ASSESSMENT_SNAPSHOT_PACK_VERSION,
    snapshotId: input.snapshotId,
    companyId: input.companyId,
    assessmentGoal: input.assessmentGoal ?? null,
    companyStage: input.companyStage ?? null,
    createdAt,
    analysisVersion: input.analysisVersion ?? CURRENT_ANALYSIS_VERSION,
    extractionVersion: input.extractionVersion ?? CURRENT_EXTRACTION_VERSION,
    evidenceVersion:
      input.evidenceVersion ??
      `evidence-count-${input.evidenceIds.length}`,
    documentVersions: input.documentVersions ?? [],
    status: "completed",
    generatedBy: input.generatedBy ?? "assessment-snapshot-engine",
    confidence,
    coverageRatio,
    overallHealthAvailable: input.healthScore.scoreAvailable !== false,
    healthScore: input.healthScore,
    dimensions: input.dimensions,
    scoreChange: input.scoreChange,
    findings: input.findings,
    risks: input.risks,
    recommendations: input.recommendations,
    questionAnswers: input.questionAnswers ?? [],
    questionCoverage: input.questionCoverage ?? null,
    businessConcepts: input.businessConcepts ?? [],
    evidenceIds: input.evidenceIds,
    documentIds: input.documentIds ?? [],
    provenance: {
      parentSnapshotId: input.parentSnapshotId ?? null,
      priorSnapshotId: input.priorSnapshotId ?? null,
    },
  };
}

export function validateAssessmentSnapshotPack(
  pack: AssessmentSnapshotPack,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!pack.snapshotId) errors.push("missing snapshotId");
  if (!pack.companyId) errors.push("missing companyId");
  if (pack.schemaVersion !== ASSESSMENT_SNAPSHOT_PACK_VERSION) {
    errors.push(`unsupported schemaVersion: ${pack.schemaVersion}`);
  }
  if (!Array.isArray(pack.findings)) errors.push("findings must be an array");
  if (!Array.isArray(pack.risks)) errors.push("risks must be an array");
  if (!Array.isArray(pack.recommendations)) {
    errors.push("recommendations must be an array");
  }
  if (!Array.isArray(pack.questionAnswers)) {
    errors.push("questionAnswers must be an array");
  }
  if (!pack.healthScore) errors.push("missing healthScore");
  if (!Array.isArray(pack.evidenceIds)) errors.push("evidenceIds must be an array");

  // No mixed snapshot objects — every nested entity must belong to this pack id when present.
  for (const answer of pack.questionAnswers) {
    if (answer.snapshotId && answer.snapshotId !== pack.snapshotId) {
      errors.push(
        `question answer ${answer.questionId} references foreign snapshot ${answer.snapshotId}`,
      );
    }
  }
  for (const concept of pack.businessConcepts) {
    if (concept.snapshotId && concept.snapshotId !== pack.snapshotId) {
      errors.push(
        `concept ${concept.conceptId} references foreign snapshot ${concept.snapshotId}`,
      );
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
