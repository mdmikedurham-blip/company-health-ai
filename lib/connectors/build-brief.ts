import type {
  BriefWin,
  ExecutiveBrief,
  Finding,
  HealthScore,
  Insight,
  Risk,
  ScoreChangeExplanation,
} from "@/lib/domain";
import { resolveAsOf } from "@/lib/intelligence";

export interface BriefSeed {
  /** Board meeting schedule — company calendar, not engine-derived. */
  boardMeeting: ExecutiveBrief["boardMeeting"];
}

/**
 * Compose ExecutiveBrief from Insight Engine output.
 * Highlights / wins / summary come from findings & risks — not static copy.
 */
export function buildExecutiveBrief(params: {
  healthScore: HealthScore;
  scoreChange: ScoreChangeExplanation;
  findings: Finding[];
  insights: Insight[];
  risks: Risk[];
  seed: BriefSeed;
  asOf?: Date | string;
}): ExecutiveBrief {
  const asOf = resolveAsOf(params.asOf);
  const date = asOf.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const generatedAt = asOf.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  const highlights = [
    ...params.risks.slice(0, 2).map((r) => r.summary),
    ...params.insights
      .filter((i) => i.type === "positive")
      .slice(0, 2)
      .map((i) => i.statement),
  ].slice(0, 3);

  const topWins: BriefWin[] = params.findings
    .filter((f) => f.direction === "positive")
    .slice(0, 3)
    .map((f) => ({
      title: f.title,
      detail: f.description,
    }));

  // Align board prep item details with open risks when titles overlap
  const boardMeeting = {
    ...params.seed.boardMeeting,
    items: params.seed.boardMeeting.items.map((item) => {
      const related = params.risks.find((r) =>
        item.title.toLowerCase().includes(r.title.toLowerCase().split(" ")[0] ?? ""),
      );
      if (!related) return item;
      return {
        ...item,
        status: related.severity === "high" ? ("needs-attention" as const) : item.status,
        detail: related.summary,
      };
    }),
  };

  return {
    date,
    generatedAt,
    summary: params.scoreChange.summary,
    highlights:
      highlights.length > 0
        ? highlights
        : [`Health score ${params.healthScore.score} (${params.healthScore.changeLabel}).`],
    topWins:
      topWins.length > 0
        ? topWins
        : [
            {
              title: "Assessment complete",
              detail: params.scoreChange.summary,
            },
          ],
    boardMeeting,
  };
}
