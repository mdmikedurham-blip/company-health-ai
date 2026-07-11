/**
 * Explainability: Health → Dimension → Question → Concept → Evidence → Document
 */

import type {
  BusinessConcept,
  DiligenceExplainabilityPath,
} from "@/lib/domain/business-concept";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import { getQuestionDefinition } from "@/lib/diligence/catalog";
import { conceptsForQuestion } from "@/lib/diligence/question-concepts";

export function buildExplainabilityPath(input: {
  questionId: string;
  answers: DiligenceQuestionAnswer[];
  concepts: BusinessConcept[];
}): DiligenceExplainabilityPath | null {
  const answer = input.answers.find((a) => a.questionId === input.questionId);
  const question = getQuestionDefinition(input.questionId);
  if (!answer || !question) return null;

  const conceptIds = answer.conceptIds ?? conceptsForQuestion(input.questionId);
  const concepts = input.concepts.filter((c) =>
    conceptIds.includes(c.conceptId),
  );

  const evidenceIds = [
    ...new Set([
      ...answer.supportingEvidenceIds,
      ...concepts.flatMap((c) => c.supportingEvidenceIds),
      ...concepts.flatMap((c) => c.contradictingEvidenceIds),
    ]),
  ];
  const documentIds = [
    ...new Set(concepts.flatMap((c) => c.supportingDocumentIds)),
  ];

  return {
    dimensionId: question.dimension,
    questionId: input.questionId,
    answerState: answer.state,
    concepts: concepts.map((c) => ({
      conceptId: c.conceptId,
      label: c.label,
      state: c.state,
      confidence: c.confidence,
      evidenceIds: [
        ...new Set([
          ...c.supportingEvidenceIds,
          ...c.contradictingEvidenceIds,
        ]),
      ],
      documentIds: c.supportingDocumentIds,
      factKeys: c.supportingFactKeys,
    })),
    evidenceIds,
    documentIds,
  };
}

export function buildAllExplainabilityPaths(input: {
  answers: DiligenceQuestionAnswer[];
  concepts: BusinessConcept[];
}): DiligenceExplainabilityPath[] {
  return input.answers
    .map((a) =>
      buildExplainabilityPath({
        questionId: a.questionId,
        answers: input.answers,
        concepts: input.concepts,
      }),
    )
    .filter((p): p is DiligenceExplainabilityPath => p != null);
}
