/**
 * Shared playbook interpretation helpers — used by definePlaybook.
 * Evidence is never mutated; only ordering and narrative change.
 */

import type {
  DimensionPriority,
  RecommendationPriority,
  ReportingTemplateSpec,
} from "@/lib/domain/assessment-goal";
import type { DiligenceQuestionAnswer } from "@/lib/domain/diligence-question";
import type {
  PlaybookEvidenceSpec,
  PlaybookId,
  PlaybookInterpretationContext,
  PlaybookMissingEvidenceItem,
  PlaybookQuestionPriority,
  PlaybookUploadPriority,
} from "@/lib/domain/playbook";
import { PLAYBOOK_ENGINE_VERSION } from "@/lib/domain/playbook";
import type { Recommendation } from "@/lib/domain/recommendation";
import type { PlaybookProvider } from "./provider";

export type PlaybookDefinition = {
  id: PlaybookId;
  label: string;
  objective: string;
  successCriteria: string[];
  focusAreas: string[];
  dimensionPriorities: DimensionPriority[];
  questionPriorities: PlaybookQuestionPriority[];
  requiredEvidence: PlaybookEvidenceSpec[];
  recommendedEvidence: PlaybookEvidenceSpec[];
  reportSections: string[];
  recommendationOrdering: RecommendationPriority[];
  /** Boost recommendations whose dimensionId matches. */
  recommendationDimensionWeights?: Partial<Record<string, number>>;
  uploadCatalog: PlaybookUploadPriority[];
  reportingTemplate: ReportingTemplateSpec;
};

function questionWeightMap(
  priorities: PlaybookQuestionPriority[],
): Map<string, number> {
  return new Map(priorities.map((p) => [p.questionId, p.weight]));
}

function themeWeightMap(
  ordering: RecommendationPriority[],
): Map<string, number> {
  return new Map(ordering.map((t) => [t.theme.toLowerCase(), t.weight]));
}

function recommendationThemeBoost(
  rec: Recommendation,
  themes: Map<string, number>,
  dimWeights: Partial<Record<string, number>> | undefined,
): number {
  let boost = 1;
  const dim = rec.dimensionId?.toLowerCase() ?? "";
  if (dimWeights) {
    for (const [key, weight] of Object.entries(dimWeights)) {
      if (weight == null) continue;
      if (dim.includes(key.replace(/^dim-/, "")) || dim === key) {
        boost = Math.max(boost, weight);
      }
    }
  }
  const hay = `${rec.title} ${rec.description} ${rec.rationale}`.toLowerCase();
  for (const [theme, weight] of themes) {
    if (hay.includes(theme) || dim.includes(theme)) {
      boost = Math.max(boost, weight);
    }
  }
  return boost;
}

function coveragePercent(context: PlaybookInterpretationContext): number {
  if (context.coverage) {
    return Math.round(context.coverage.coverageRatio * 100);
  }
  const applicable = context.answers.filter(
    (a) => a.stageLevel !== "not_applicable",
  );
  if (applicable.length === 0) return 0;
  const answered = applicable.filter(
    (a) =>
      a.state === "SUPPORTED" ||
      a.state === "CONTRADICTED" ||
      a.state === "INSUFFICIENT_EVIDENCE",
  );
  return Math.round((answered.length / applicable.length) * 100);
}

function readinessFromAnswers(
  answers: DiligenceQuestionAnswer[],
  priorities: PlaybookQuestionPriority[],
): { percent: number; blockers: string[] } {
  const weights = questionWeightMap(priorities);
  const applicable = answers.filter((a) => a.stageLevel !== "not_applicable");
  if (applicable.length === 0) {
    return { percent: 0, blockers: ["No applicable diligence questions yet."] };
  }

  let earned = 0;
  let possible = 0;
  const blockers: string[] = [];

  for (const answer of applicable) {
    const w = weights.get(answer.questionId) ?? 1;
    possible += w;
    if (answer.state === "SUPPORTED") {
      earned += w;
    } else if (
      answer.state === "CONTRADICTED" ||
      answer.state === "INSUFFICIENT_EVIDENCE"
    ) {
      if (w >= 1.2 || answer.effectiveImportance >= 3) {
        blockers.push(
          `${answer.questionId}: ${answer.reasoning || answer.state}`,
        );
      }
    }
  }

  const percent =
    possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return {
    percent,
    blockers: blockers.slice(0, 8),
  };
}

export function definePlaybook(def: PlaybookDefinition): PlaybookProvider {
  const qWeights = questionWeightMap(def.questionPriorities);
  const themes = themeWeightMap(def.recommendationOrdering);

  const provider: PlaybookProvider = {
    id: def.id,
    label: def.label,
    objective: def.objective,
    playbookVersion: PLAYBOOK_ENGINE_VERSION,
    successCriteria: def.successCriteria,
    focusAreas: def.focusAreas,

    getDimensionPriorities: () => def.dimensionPriorities,
    getQuestionPriorities: () => def.questionPriorities,
    getRequiredEvidence: () => def.requiredEvidence,
    getRecommendedEvidence: () => def.recommendedEvidence,
    getReportSections: () => def.reportSections,
    getRecommendationOrdering: () => def.recommendationOrdering,
    getUploadCatalog: () => def.uploadCatalog,
    getReportingTemplate: () => def.reportingTemplate,

    prioritizeQuestions(answers) {
      const byId = new Map(answers.map((a) => [a.questionId, a]));
      const ids = [
        ...new Set([
          ...def.questionPriorities.map((p) => p.questionId),
          ...answers.map((a) => a.questionId),
        ]),
      ];
      return ids
        .map((id) => {
          const answer = byId.get(id);
          const playbookW = qWeights.get(id) ?? 1;
          const effective = answer?.effectiveImportance ?? 1;
          const stagePenalty =
            answer?.stageLevel === "not_applicable" ? 0 : 1;
          return {
            id,
            score: playbookW * effective * stagePenalty,
          };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .map((row) => row.id);
    },

    prioritizeRecommendations(recommendations) {
      return [...recommendations]
        .map((rec) => {
          const boost = recommendationThemeBoost(
            rec,
            themes,
            def.recommendationDimensionWeights,
          );
          return {
            ...rec,
            priorityScore: Math.round(rec.priorityScore * boost * 1000) / 1000,
          };
        })
        .sort(
          (a, b) =>
            b.priorityScore - a.priorityScore ||
            a.title.localeCompare(b.title),
        );
    },

    prioritizeUploads(context) {
      const present = new Set(context.presentEvidenceTypes);
      return def.uploadCatalog.filter((item) => {
        if (item.evidenceTypes.length === 0) return true;
        return !item.evidenceTypes.every((t) => present.has(t));
      });
    },

    generateMissingEvidence(context) {
      const present = new Set(context.presentEvidenceTypes);
      const related = new Map<string, string[]>();
      for (const answer of context.answers) {
        for (const type of answer.missingEvidence ?? []) {
          const list = related.get(type) ?? [];
          list.push(answer.questionId);
          related.set(type, list);
        }
      }

      const specs = [
        ...def.requiredEvidence,
        ...def.recommendedEvidence,
      ];
      const items: PlaybookMissingEvidenceItem[] = [];

      for (const spec of specs) {
        if (present.has(spec.evidenceType)) continue;
        const qIds = related.get(spec.evidenceType) ?? [];
        const maxQ = Math.max(
          0,
          ...qIds.map((id) => qWeights.get(id) ?? 1),
        );
        items.push({
          evidenceType: spec.evidenceType,
          label: spec.label,
          level: spec.level,
          why: spec.why,
          relatedQuestionIds: qIds,
          priorityWeight: maxQ || (spec.level === "required" ? 1.2 : 1),
        });
      }

      // Also surface answer-level missing types not in the static catalog.
      for (const [type, qIds] of related) {
        if (items.some((i) => i.evidenceType === type)) continue;
        if (present.has(type)) continue;
        items.push({
          evidenceType: type,
          label: type.replace(/_/g, " "),
          level: "recommended",
          why: "Raised by diligence questions under this playbook.",
          relatedQuestionIds: qIds,
          priorityWeight: Math.max(
            1,
            ...qIds.map((id) => qWeights.get(id) ?? 1),
          ),
        });
      }

      return items.sort(
        (a, b) =>
          b.priorityWeight - a.priorityWeight ||
          a.evidenceType.localeCompare(b.evidenceType),
      );
    },

    generateReadiness(context) {
      const { percent, blockers } = readinessFromAnswers(
        context.answers,
        def.questionPriorities,
      );
      const cov = coveragePercent(context);
      const uploads = provider.prioritizeUploads(context);
      const recs = provider.prioritizeRecommendations(context.recommendations);

      return {
        playbookId: def.id,
        playbookVersion: PLAYBOOK_ENGINE_VERSION,
        readinessPercent: percent,
        coveragePercent: cov,
        criticalBlockers: blockers,
        highPriorityUploads: uploads
          .filter((u) => u.level === "required" || u.level === "recommended")
          .slice(0, 5),
        topRecommendations: recs.slice(0, 5),
        successCriteria: def.successCriteria,
        generatedAt: context.generatedAt ?? new Date().toISOString(),
      };
    },

    generateExecutiveSummary(context) {
      const readiness = provider.generateReadiness(context);
      const topRec = readiness.topRecommendations[0];
      const blockerLine =
        readiness.criticalBlockers.length > 0
          ? `Critical gaps: ${readiness.criticalBlockers
              .slice(0, 3)
              .map((b) => b.split(":")[0])
              .join(", ")}.`
          : "No critical question blockers detected from current evidence.";

      const paragraphs = [
        `${def.label} readiness is ${readiness.readinessPercent}% with ${readiness.coveragePercent}% question coverage.`,
        blockerLine,
        topRec
          ? `Highest-priority action: ${topRec.title}.`
          : "Upload the next required evidence to unlock playbook-specific recommendations.",
        `Focus areas for this playbook: ${def.focusAreas.join(", ")}.`,
      ];

      return {
        playbookId: def.id,
        title: `${def.label} executive summary`,
        headline: `${def.label}: ${readiness.readinessPercent}% ready`,
        paragraphs,
        focusAreas: def.focusAreas,
        generatedAt: context.generatedAt ?? new Date().toISOString(),
      };
    },
  };

  return provider;
}
