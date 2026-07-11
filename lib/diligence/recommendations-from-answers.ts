/**
 * Recommendations only from CONTRADICTED or INSUFFICIENT_EVIDENCE questions
 * (and required/optional applicable questions — never NOT_APPLICABLE).
 */

import type { Recommendation } from "@/lib/domain";
import { dimensionName } from "@/lib/domain/dimensions";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import {
  EFFORT_MULTIPLIER,
  priorityFromScore,
  SEVERITY_MULTIPLIER,
} from "@/lib/intelligence/rules";
import { getQuestionDefinition } from "./catalog";

function estimateSeverity(
  state: DiligenceQuestionAnswer["state"],
  importance: number,
): "high" | "medium" | "low" {
  if (state === "CONTRADICTED" && importance >= 3) return "high";
  if (state === "CONTRADICTED") return "medium";
  if (importance >= 3) return "medium";
  return "low";
}

export function generateRecommendationsFromAnswers(
  answers: DiligenceQuestionAnswer[],
  options?: { evidenceCount?: number },
): Recommendation[] {
  // No evidence corpus → no recommendations (never invent work from a void).
  if ((options?.evidenceCount ?? 1) === 0) return [];

  const recommendations: Recommendation[] = [];

  for (const answer of answers) {
    if (answer.stageLevel === "not_applicable") continue;
    if (
      answer.state !== "CONTRADICTED" &&
      answer.state !== "INSUFFICIENT_EVIDENCE"
    ) {
      continue;
    }

    const question = getQuestionDefinition(answer.questionId);
    const template = question?.recommendationTemplate;
    if (!question || !template) continue;

    const severity = estimateSeverity(answer.state, answer.effectiveImportance);
    const estimatedScoreImprovement = template.estimatedScoreImprovement;
    const priorityScore =
      Math.round(
        ((estimatedScoreImprovement *
          SEVERITY_MULTIPLIER[severity] *
          (Math.max(answer.confidence, 25) / 100)) /
          EFFORT_MULTIPLIER[template.effort]) *
          100,
      ) / 100;

    recommendations.push({
      id: template.id,
      title: template.title,
      description: template.description,
      dimensionId: question.dimension,
      dimension: dimensionName(question.dimension),
      riskIds: [],
      evidenceIds: answer.supportingEvidenceIds,
      priority: priorityFromScore(priorityScore),
      effort: template.effort,
      confidence: answer.confidence,
      estimatedScoreImprovement,
      rationale: `${template.rationale} (${answer.state}: ${answer.reasoning})`,
      nextSteps: template.nextSteps,
      priorityScore,
      findingIds: [],
    });
  }

  return recommendations
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .filter((rec, index, all) => all.findIndex((r) => r.id === rec.id) === index);
}
