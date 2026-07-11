/**
 * Assessment Snapshot — Phase 6 canonical published assessment.
 * One current published snapshot per company; historical snapshots are immutable.
 */

import type { AssessmentGoalId } from "./assessment-goal";
import type { BusinessConcept } from "./business-concept";
import type { CompanyLifecycleStage } from "./company-classification";
import type {
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "./diligence-question";
import type { Finding } from "./finding";
import type { HealthDimension, HealthScore } from "./health";
import type { Recommendation } from "./recommendation";
import type { Risk } from "./risk";
import type { ScoreChangeExplanation } from "./primitives";
import type { CompanyId } from "./primitives";

export type AssessmentSnapshotPublishKind =
  | "draft"
  | "published"
  | "superseded"
  | "failed"
  | "legacy";

export type AssessmentSnapshotStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type DocumentVersionStamp = {
  documentId: string;
  contentHash?: string | null;
  extractionVersion?: string | null;
  analysisVersion?: string | null;
};

/**
 * Immutable publish pack stored in analysis_snapshots.payload for published rows.
 */
export type AssessmentSnapshotPack = {
  schemaVersion: "assessment-snapshot-pack-v1";
  snapshotId: string;
  companyId: CompanyId;
  assessmentGoal: AssessmentGoalId | string | null;
  /** Phase 7 — frozen playbook engine version (playbook id mirrors assessmentGoal). */
  playbookVersion: string | null;
  companyStage: CompanyLifecycleStage | string | null;
  createdAt: string;
  analysisVersion: string;
  extractionVersion: string;
  evidenceVersion: string;
  documentVersions: DocumentVersionStamp[];
  status: AssessmentSnapshotStatus;
  generatedBy: string;
  confidence: number;
  coverageRatio: number;
  overallHealthAvailable: boolean;
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange: ScoreChangeExplanation;
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  questionAnswers: DiligenceQuestionAnswer[];
  questionCoverage: QuestionCoverageReport | null;
  businessConcepts: BusinessConcept[];
  evidenceIds: string[];
  documentIds: string[];
  provenance: {
    parentSnapshotId: string | null;
    priorSnapshotId: string | null;
  };
};

export type AssessmentSnapshotRecord = {
  snapshotId: string;
  companyId: CompanyId;
  publishKind: AssessmentSnapshotPublishKind;
  status: AssessmentSnapshotStatus;
  assessmentGoal: AssessmentGoalId | string | null;
  companyStage: CompanyLifecycleStage | string | null;
  createdAt: string;
  publishedAt: string | null;
  analysisVersion: string | null;
  extractionVersion: string | null;
  evidenceVersion: string | null;
  documentVersions: DocumentVersionStamp[];
  generatedBy: string | null;
  confidence: number | null;
  coverageRatio: number | null;
  overallHealthAvailable: boolean;
  parentSnapshotId: string | null;
  supersededBy: string | null;
  pack: AssessmentSnapshotPack | null;
};

export type AssessmentSnapshotDiff = {
  currentSnapshotId: string;
  previousSnapshotId: string | null;
  newFindingIds: string[];
  resolvedFindingIds: string[];
  newRiskIds: string[];
  resolvedRiskIds: string[];
  recommendationAddedIds: string[];
  recommendationRemovedIds: string[];
  scoreMovement: {
    previous: number | null;
    current: number | null;
    delta: number | null;
  };
  coverageMovement: {
    previous: number | null;
    current: number | null;
    delta: number | null;
  };
  confidenceMovement: {
    previous: number | null;
    current: number | null;
    delta: number | null;
  };
  newEvidenceIds: string[];
  removedEvidenceIds: string[];
};
