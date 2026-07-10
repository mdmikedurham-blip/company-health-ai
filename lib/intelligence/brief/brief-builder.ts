import type {
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import { resolveAsOf } from "@/lib/intelligence/insight-engine";
import { analyzeCausalDrivers } from "./causal-analyzer";
import type {
  BriefActionItem,
  BriefBoardImplication,
  BriefPreviousSlice,
  BriefRiskItem,
  BriefSeed,
  CausalDriver,
  ExecutiveBrief,
} from "./brief-types";

export type { BriefSeed };

export interface BuildCausalBriefInput {
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  previous?: BriefPreviousSlice;
  seed?: BriefSeed;
  asOf?: Date | string;
}

/**
 * Deterministic Causal Brief Builder.
 * Timeline + Evidence + Findings + Risks + Health Score Delta
 * → Causal Analyzer → Executive Brief.
 *
 * No hardcoded narrative copy — every statement cites evidence IDs.
 */
export function buildCausalExecutiveBrief(
  input: BuildCausalBriefInput,
): ExecutiveBrief {
  const asOf = resolveAsOf(input.asOf);
  const analysis = analyzeCausalDrivers({
    healthScore: input.healthScore,
    dimensions: input.dimensions,
    findings: input.findings,
    risks: input.risks,
    recommendations: input.recommendations,
    evidence: input.evidence,
    timeline: input.timeline,
    previous: input.previous,
  });

  const { scoreDelta, primaryDrivers, secondaryDrivers, confidence } = analysis;

  const headline = buildHeadline(scoreDelta.change, scoreDelta.currentScore);
  const overallSummary = buildOverallSummary({
    scoreDelta,
    primaryDrivers,
    insufficientEvidence: analysis.insufficientEvidence,
    conflictingEvidence: analysis.conflictingEvidence,
  });

  const topRisks = buildTopRisks(input.risks);
  const recommendedActions = buildRecommendedActions(
    input.recommendations,
    primaryDrivers,
    secondaryDrivers,
  );
  const boardImplications = buildBoardImplications(
    input.seed,
    input.risks,
    primaryDrivers,
    secondaryDrivers,
  );

  const evidenceReferences = uniqueSorted([
    ...primaryDrivers.flatMap((d) => d.evidenceIds),
    ...secondaryDrivers.flatMap((d) => d.evidenceIds),
    ...topRisks.flatMap((r) => r.evidenceIds),
    ...recommendedActions.flatMap((a) => a.evidenceIds),
    ...boardImplications.flatMap((b) => b.evidenceIds),
  ]);

  const timelineReferences = uniqueSorted([
    ...primaryDrivers.flatMap((d) => d.timelineEventIds),
    ...secondaryDrivers.flatMap((d) => d.timelineEventIds),
    ...input.timeline
      .filter(
        (t) =>
          t.type === "overall-score-changed" || t.type === "score-change",
      )
      .map((t) => t.id),
  ]);

  return {
    headline,
    overallSummary,
    scoreChange: {
      previousScore: scoreDelta.previousScore,
      currentScore: scoreDelta.currentScore,
      change: scoreDelta.change,
    },
    primaryDrivers,
    secondaryDrivers,
    topRisks,
    recommendedActions,
    boardImplications,
    confidence,
    generatedAt: formatGeneratedAt(asOf),
    evidenceReferences,
    timelineReferences,
    date: formatBriefDate(asOf),
    boardMeeting: input.seed?.boardMeeting
      ? {
          date: input.seed.boardMeeting.date,
          daysUntil: input.seed.boardMeeting.daysUntil,
        }
      : undefined,
  };
}

function buildHeadline(change: number, currentScore: number): string {
  if (change > 0) {
    return `Health improved ${change} point${change === 1 ? "" : "s"} to ${currentScore}.`;
  }
  if (change < 0) {
    const abs = Math.abs(change);
    return `Health declined ${abs} point${abs === 1 ? "" : "s"} to ${currentScore}.`;
  }
  return `Health unchanged at ${currentScore}.`;
}

function buildOverallSummary(params: {
  scoreDelta: { previousScore: number; currentScore: number; change: number };
  primaryDrivers: CausalDriver[];
  insufficientEvidence: boolean;
  conflictingEvidence: boolean;
}): string {
  const { scoreDelta, primaryDrivers } = params;
  const parts: string[] = [];

  parts.push(
    `Score ${scoreDelta.previousScore} → ${scoreDelta.currentScore} (${formatSigned(scoreDelta.change)}).`,
  );

  if (params.insufficientEvidence) {
    parts.push(
      "Insufficient evidence to explain score movement; confidence reduced.",
    );
    return parts.join(" ");
  }

  if (primaryDrivers.length === 0) {
    parts.push("No material drivers identified for this period.");
    return parts.join(" ");
  }

  const why = primaryDrivers
    .map((d) => {
      const cite =
        d.evidenceIds.length > 0
          ? ` [${d.evidenceIds.join(", ")}]`
          : " [no evidence]";
      return `${d.title} (${formatSigned(d.healthImpact)}, ${d.businessMateriality})${cite}`;
    })
    .join("; ");

  parts.push(`Why: ${why}.`);

  if (params.conflictingEvidence) {
    parts.push(
      "Conflicting findings within one or more dimensions; treat drivers with caution.",
    );
  }

  return parts.join(" ");
}

function buildTopRisks(risks: Risk[]): BriefRiskItem[] {
  return [...risks]
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      if (b.estimatedScoreImpact !== a.estimatedScoreImpact) {
        return Math.abs(b.estimatedScoreImpact) - Math.abs(a.estimatedScoreImpact);
      }
      return a.id.localeCompare(b.id);
    })
    .slice(0, 3)
    .map((r) => ({
      riskId: r.id,
      title: r.title,
      severity: r.severity,
      dimension: r.dimension,
      summary: `${r.summary} Evidence: ${[...r.evidenceIds].sort().join(", ") || "none"}.`,
      evidenceIds: [...r.evidenceIds].sort(),
    }));
}

function buildRecommendedActions(
  recommendations: Recommendation[],
  primary: CausalDriver[],
  secondary: CausalDriver[],
): BriefActionItem[] {
  const linkedRecIds = new Set(
    [...primary, ...secondary]
      .map((d) => d.recommendationId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id)),
  );

  const ranked = [...recommendations].sort((a, b) => {
    const aLinked = linkedRecIds.has(a.id) ? 1 : 0;
    const bLinked = linkedRecIds.has(b.id) ? 1 : 0;
    if (bLinked !== aLinked) return bLinked - aLinked;
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.id.localeCompare(b.id);
  });

  return ranked.slice(0, 3).map((r) => ({
    recommendationId: r.id,
    title: r.title,
    priority: r.priority,
    dimension: r.dimension,
    description: `${r.description} Evidence: ${[...r.evidenceIds].sort().join(", ") || "none"}.`,
    evidenceIds: [...r.evidenceIds].sort(),
  }));
}

function buildBoardImplications(
  seed: BriefSeed | undefined,
  risks: Risk[],
  primary: CausalDriver[],
  secondary: CausalDriver[],
): BriefBoardImplication[] {
  const driverEvidence = uniqueSorted([
    ...primary.flatMap((d) => d.evidenceIds),
    ...secondary.flatMap((d) => d.evidenceIds),
  ]);

  if (!seed?.boardMeeting?.items?.length) {
    // Derive board implications from negative primary drivers when no calendar seed
    return primary
      .filter((d) => d.direction === "negative")
      .slice(0, 3)
      .map((d) => ({
        title: d.dimension,
        status: "needs-attention" as const,
        detail: `${d.statement}`,
        evidenceIds: d.evidenceIds,
      }));
  }

  return seed.boardMeeting.items.map((item) => {
    const related = risks.find((r) =>
      item.title
        .toLowerCase()
        .includes(r.title.toLowerCase().split(" ")[0] ?? ""),
    );
    const evidenceIds = related
      ? [...related.evidenceIds].sort()
      : driverEvidence.slice(0, 3);

    const status =
      related?.severity === "high"
        ? ("needs-attention" as const)
        : item.status;

    const detail = related
      ? `${related.summary} Evidence: ${evidenceIds.join(", ") || "none"}.`
      : evidenceIds.length > 0
        ? `Board item linked to period drivers. Evidence: ${evidenceIds.join(", ")}.`
        : "No linked evidence for this board item.";

    return {
      title: item.title,
      status,
      detail,
      evidenceIds,
    };
  });
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatBriefDate(asOf: Date): string {
  return asOf.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatGeneratedAt(asOf: Date): string {
  return asOf.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}
