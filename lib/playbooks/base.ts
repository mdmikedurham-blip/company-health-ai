/**
 * Shared playbook interpretation helpers — used by definePlaybook.
 * Evidence is never mutated; only ordering and narrative change.
 */

import type {
  DimensionPriority,
  RecommendationPriority,
} from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import { COMPANY_LIFECYCLE_STAGES } from "@/lib/domain/company-classification";
import type {
  PlaybookEvidenceSpec,
  PlaybookId,
  PlaybookInterpretationContext,
  PlaybookMissingEvidenceItem,
  PlaybookQuestionPriority,
  PlaybookReportSection,
  PlaybookUploadPriority,
} from "@/lib/domain/playbook";
import { PLAYBOOK_ENGINE_VERSION } from "@/lib/domain/playbook";
import type { Recommendation } from "@/lib/domain/recommendation";
import type { PlaybookProvider } from "./provider";

export type PlaybookDefinition = {
  id: PlaybookId;
  name: string;
  objective: string;
  successCriteria: string[];
  focusAreas: string[];
  applicableLifecycleStages?: CompanyLifecycleStage[];
  minCoveragePercent?: number;
  executiveSummaryGuidance: string[];
  dimensionPriorities: DimensionPriority[];
  questionPriorities: PlaybookQuestionPriority[];
  requiredEvidence: PlaybookEvidenceSpec[];
  recommendedEvidence: PlaybookEvidenceSpec[];
  reportSections: PlaybookReportSection[] | string[];
  recommendationOrdering: RecommendationPriority[];
  recommendationDimensionWeights?: Partial<Record<string, number>>;
  uploadCatalog: PlaybookUploadPriority[];
  blockerWeightThreshold?: number;
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

function normalizeReportSections(
  sections: PlaybookReportSection[] | string[],
): PlaybookReportSection[] {
  return sections.map((s, i) =>
    typeof s === "string"
      ? { id: `section-${i + 1}`, title: s }
      : s,
  );
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

function stageApplies(
  stages: CompanyLifecycleStage[],
  stage: CompanyLifecycleStage | null | undefined,
): boolean {
  if (!stage || stages.length === 0) return true;
  return stages.includes(stage);
}

function uploadApplies(
  item: PlaybookUploadPriority,
  stage: CompanyLifecycleStage | null | undefined,
): boolean {
  return stageApplies(item.applicableStages, stage);
}

export function definePlaybook(def: PlaybookDefinition): PlaybookProvider {
  const qWeights = questionWeightMap(def.questionPriorities);
  const themes = themeWeightMap(def.recommendationOrdering);
  const reportSections = normalizeReportSections(def.reportSections);
  const applicableLifecycleStages =
    def.applicableLifecycleStages ?? [...COMPANY_LIFECYCLE_STAGES];
  const minCoveragePercent = def.minCoveragePercent ?? 25;
  const blockerWeightThreshold = def.blockerWeightThreshold ?? 1.2;

  const provider: PlaybookProvider = {
    id: def.id,
    name: def.name,
    label: def.name,
    objective: def.objective,
    playbookVersion: PLAYBOOK_ENGINE_VERSION,
    successCriteria: def.successCriteria,
    focusAreas: def.focusAreas,
    applicableLifecycleStages,
    minCoveragePercent,
    executiveSummaryGuidance: def.executiveSummaryGuidance,

    getDimensionPriorities: () => def.dimensionPriorities,
    getQuestionPriorities: () => def.questionPriorities,
    getRequiredEvidence: () => def.requiredEvidence,
    getRecommendedEvidence: () => def.recommendedEvidence,
    getRecommendationOrdering: () => def.recommendationOrdering,
    getUploadCatalog: () => def.uploadCatalog,
    getReadinessRules: () => ({
      minCoveragePercent,
      blockerWeightThreshold,
    }),
    getReportSections: () => reportSections.map((s) => s.title),

    prioritizeQuestions(answers, stage) {
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
          // Playbook applicability: out-of-scope stages zero out IPO-style pressure
          // when the company's stage is not in this playbook's applicable set —
          // but Run the Company includes all stages, so stage NA on the answer wins.
          const playbookStageOk = stageApplies(
            applicableLifecycleStages,
            stage ?? null,
          );
          const applicability = playbookStageOk ? 1 : 0.15;
          return {
            id,
            score: playbookW * effective * stagePenalty * applicability,
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
      return def.uploadCatalog
        .filter((item) => uploadApplies(item, context.companyStage))
        .filter((item) => {
          if (item.evidenceTypes.length === 0) return true;
          return !item.evidenceTypes.every((t) => present.has(t));
        })
        .sort(
          (a, b) =>
            b.priority - a.priority ||
            a.label.localeCompare(b.label),
        );
    },

    generateMissingEvidence(context) {
      const present = new Set(context.presentEvidenceTypes);
      const related = new Map<string, string[]>();
      for (const answer of context.answers) {
        if (answer.stageLevel === "not_applicable") continue;
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
          category: spec.category,
        });
      }

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

    identifyCriticalBlockers(context) {
      const blockers: string[] = [];
      for (const answer of context.answers) {
        if (answer.stageLevel === "not_applicable") continue;
        const w = qWeights.get(answer.questionId) ?? 1;
        if (
          (answer.state === "CONTRADICTED" ||
            answer.state === "INSUFFICIENT_EVIDENCE") &&
          (w >= blockerWeightThreshold || answer.effectiveImportance >= 3)
        ) {
          blockers.push(
            `${answer.questionId}: ${answer.reasoning || answer.state}`,
          );
        }
      }
      return blockers.slice(0, 8);
    },

    calculateReadiness(context) {
      const cov = coveragePercent(context);
      const readinessAvailable = cov >= minCoveragePercent;
      const applicable = context.answers.filter(
        (a) => a.stageLevel !== "not_applicable",
      );

      let earned = 0;
      let possible = 0;
      const unsupportedQuestions: string[] = [];

      for (const answer of applicable) {
        const w = qWeights.get(answer.questionId) ?? 1;
        possible += w;
        if (answer.state === "SUPPORTED") {
          earned += w;
        } else if (
          answer.state === "INSUFFICIENT_EVIDENCE" ||
          answer.state === "UNKNOWN" ||
          answer.state === "CONTRADICTED"
        ) {
          unsupportedQuestions.push(answer.questionId);
        }
      }

      const percent =
        possible > 0 ? Math.round((earned / possible) * 100) : 0;
      const blockers = provider.identifyCriticalBlockers(context);
      const uploads = provider.prioritizeUploads(context);
      const recs = provider.prioritizeRecommendations(context.recommendations);
      const confidence =
        context.coverage?.meanConfidence ??
        context.healthScore?.confidence ??
        null;

      return {
        playbookId: def.id,
        playbookVersion: PLAYBOOK_ENGINE_VERSION,
        readinessAvailable,
        readinessPercent: readinessAvailable ? percent : null,
        evidenceCoveragePercent: cov,
        criticalBlockers: blockers,
        highPriorityUploads: uploads
          .filter((u) => u.level === "required" || u.level === "recommended")
          .slice(0, 5),
        topRecommendations: recs.slice(0, 5),
        unsupportedQuestions: [...new Set(unsupportedQuestions)].slice(0, 20),
        confidence,
        snapshotId: context.snapshotId,
        successCriteria: def.successCriteria,
        generatedAt: context.generatedAt ?? new Date().toISOString(),
      };
    },

    buildExecutiveSummaryContext(context) {
      const readiness = provider.calculateReadiness(context);
      const topRec = readiness.topRecommendations[0];
      const blockerLine =
        readiness.criticalBlockers.length > 0
          ? `Critical gaps: ${readiness.criticalBlockers
              .slice(0, 3)
              .map((b) => b.split(":")[0])
              .join(", ")}.`
          : "No critical question blockers detected from current evidence.";

      const readinessLine = readiness.readinessAvailable
        ? `${def.name} readiness is ${readiness.readinessPercent}% with ${readiness.evidenceCoveragePercent}% evidence coverage.`
        : `${def.name} readiness is not published yet — evidence coverage is ${readiness.evidenceCoveragePercent}% (minimum ${minCoveragePercent}%).`;

      const paragraphs = [
        readinessLine,
        blockerLine,
        topRec
          ? `Highest-priority action: ${topRec.title}.`
          : "Upload the next required evidence to unlock playbook-specific recommendations.",
        `Focus areas: ${def.focusAreas.join(", ")}.`,
        ...def.executiveSummaryGuidance.slice(0, 2),
      ];

      return {
        playbookId: def.id,
        title: `${def.name} executive summary`,
        headline: readiness.readinessAvailable
          ? `${def.name}: ${readiness.readinessPercent}% ready`
          : `${def.name}: readiness pending coverage`,
        paragraphs,
        focusAreas: def.focusAreas,
        guidance: def.executiveSummaryGuidance,
        snapshotId: context.snapshotId,
        generatedAt: context.generatedAt ?? new Date().toISOString(),
      };
    },

    buildReportSections() {
      return reportSections;
    },

    generateReadiness(context) {
      return provider.calculateReadiness(context);
    },
    generateExecutiveSummary(context) {
      return provider.buildExecutiveSummaryContext(context);
    },
  };

  return provider;
}
