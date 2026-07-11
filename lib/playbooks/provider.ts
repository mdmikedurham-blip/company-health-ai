/**
 * PlaybookProvider — strategy interface for every due diligence playbook.
 * Consumers resolve via the registry; never switch/case on playbook id.
 */

import type {
  DimensionPriority,
  RecommendationPriority,
} from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  PlaybookEvidenceSpec,
  PlaybookExecutiveSummary,
  PlaybookId,
  PlaybookInterpretationContext,
  PlaybookMeta,
  PlaybookMissingEvidenceItem,
  PlaybookQuestionPriority,
  PlaybookReadiness,
  PlaybookReportSection,
  PlaybookUploadPriority,
} from "@/lib/domain/playbook";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import type { Recommendation } from "@/lib/domain/recommendation";
import { PLAYBOOK_IDS } from "@/lib/domain/playbook";

export type PlaybookProvider = PlaybookMeta & {
  playbookVersion: string;
  successCriteria: string[];
  focusAreas: string[];
  applicableLifecycleStages: CompanyLifecycleStage[];
  /** Minimum evidenceCoveragePercent before readinessAvailable is true. */
  minCoveragePercent: number;
  executiveSummaryGuidance: string[];

  getDimensionPriorities(): DimensionPriority[];
  getQuestionPriorities(): PlaybookQuestionPriority[];
  getRequiredEvidence(): PlaybookEvidenceSpec[];
  getRecommendedEvidence(): PlaybookEvidenceSpec[];
  getRecommendationOrdering(): RecommendationPriority[];
  getUploadCatalog(): PlaybookUploadPriority[];
  getReadinessRules(): {
    minCoveragePercent: number;
    blockerWeightThreshold: number;
  };

  prioritizeQuestions(
    answers: DiligenceQuestionAnswer[],
    stage?: CompanyLifecycleStage | null,
  ): string[];
  prioritizeRecommendations(
    recommendations: Recommendation[],
  ): Recommendation[];
  prioritizeUploads(
    context: PlaybookInterpretationContext,
  ): PlaybookUploadPriority[];
  calculateReadiness(
    context: PlaybookInterpretationContext,
  ): PlaybookReadiness;
  identifyCriticalBlockers(
    context: PlaybookInterpretationContext,
  ): string[];
  generateMissingEvidence(
    context: PlaybookInterpretationContext,
  ): PlaybookMissingEvidenceItem[];
  buildExecutiveSummaryContext(
    context: PlaybookInterpretationContext,
  ): PlaybookExecutiveSummary;
  buildReportSections(
    context?: PlaybookInterpretationContext,
  ): PlaybookReportSection[];

  /** Aliases kept for earlier Phase 7 callers. */
  generateReadiness(
    context: PlaybookInterpretationContext,
  ): PlaybookReadiness;
  generateExecutiveSummary(
    context: PlaybookInterpretationContext,
  ): PlaybookExecutiveSummary;
  getReportSections(): string[];
};

export function toPlaybookMeta(provider: PlaybookProvider): PlaybookMeta {
  return {
    id: provider.id,
    name: provider.name,
    label: provider.label,
    objective: provider.objective,
  };
}

export function isPlaybookId(value: string): value is PlaybookId {
  return (PLAYBOOK_IDS as string[]).includes(value);
}
