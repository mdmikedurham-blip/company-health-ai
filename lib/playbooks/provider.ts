/**
 * PlaybookProvider — strategy interface for every due diligence playbook.
 * Consumers resolve via the registry; never switch/case on playbook id.
 */

import type {
  DimensionPriority,
  RecommendationPriority,
  ReportingTemplateSpec,
} from "@/lib/domain/assessment-goal";
import type {
  PlaybookEvidenceSpec,
  PlaybookExecutiveSummary,
  PlaybookId,
  PlaybookInterpretationContext,
  PlaybookMeta,
  PlaybookMissingEvidenceItem,
  PlaybookQuestionPriority,
  PlaybookReadiness,
  PlaybookUploadPriority,
} from "@/lib/domain/playbook";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import type { Recommendation } from "@/lib/domain/recommendation";
import { PLAYBOOK_IDS } from "@/lib/domain/playbook";

export type PlaybookProvider = PlaybookMeta & {
  playbookVersion: string;
  successCriteria: string[];
  focusAreas: string[];

  getDimensionPriorities(): DimensionPriority[];
  getQuestionPriorities(): PlaybookQuestionPriority[];
  getRequiredEvidence(): PlaybookEvidenceSpec[];
  getRecommendedEvidence(): PlaybookEvidenceSpec[];
  getReportSections(): string[];
  getRecommendationOrdering(): RecommendationPriority[];
  getUploadCatalog(): PlaybookUploadPriority[];
  getReportingTemplate(): ReportingTemplateSpec;

  prioritizeQuestions(
    answers: DiligenceQuestionAnswer[],
  ): string[];
  prioritizeRecommendations(
    recommendations: Recommendation[],
  ): Recommendation[];
  prioritizeUploads(
    context: PlaybookInterpretationContext,
  ): PlaybookUploadPriority[];
  generateExecutiveSummary(
    context: PlaybookInterpretationContext,
  ): PlaybookExecutiveSummary;
  generateReadiness(
    context: PlaybookInterpretationContext,
  ): PlaybookReadiness;
  generateMissingEvidence(
    context: PlaybookInterpretationContext,
  ): PlaybookMissingEvidenceItem[];
};

export function toPlaybookMeta(provider: PlaybookProvider): PlaybookMeta {
  return {
    id: provider.id,
    label: provider.label,
    objective: provider.objective,
  };
}

export function isPlaybookId(value: string): value is PlaybookId {
  return (PLAYBOOK_IDS as string[]).includes(value);
}
