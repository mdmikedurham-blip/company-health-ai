import type {
  CompanyHealthSnapshot,
  Evidence,
  Finding,
  HealthDimension,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import { collectStructuredFinancialFacts } from "./financial-diagnosis";
import type { ClassifiedQuery, RankedItem, RetrievalResult } from "./types";

/** Minimum score for an item to be considered relevant. */
export const RELEVANCE_FLOOR = 2.5;

/**
 * Ultra-common tokens that alone must not drive retrieval
 * (e.g. "score" matching every dimension summary).
 */
const GENERIC_TERMS = new Set([
  "score",
  "scores",
  "compliance",
  "company",
  "health",
  "report",
  "reports",
  "data",
  "system",
  "systems",
  "document",
  "documents",
  "status",
  "update",
  "overview",
  "summary",
  "analysis",
  "review",
]);

/** Soft cap on items returned per entity type. */
const LIMITS = {
  evidence: 6,
  findings: 6,
  risks: 6,
  recommendations: 5,
  dimensions: 4,
  timeline: 5,
} as const;

/** Field weights for keyword hits. */
const WEIGHTS = {
  idExact: 8,
  title: 4,
  summary: 2.5,
  dimension: 3,
  factKey: 2,
  sourceSystem: 1.5,
  severityHigh: 1.5,
  intentBoost: 3,
  dimensionHint: 4,
  explainRiskBoost: 10,
  linkedEvidence: 1.25,
  genericTerm: 0.35,
} as const;

function uniqueTerms(terms: string[]): string[] {
  return [...new Set(terms.map((t) => t.toLowerCase()).filter(Boolean))];
}

function haystackIncludes(haystack: string, term: string): boolean {
  if (!term) return false;
  if (term.length <= 2) {
    return new RegExp(`\\b${term}\\b`, "i").test(haystack);
  }
  return haystack.includes(term);
}

function termWeight(base: number, term: string): number {
  return GENERIC_TERMS.has(term) ? WEIGHTS.genericTerm : base;
}

function scoreTextFields(
  terms: string[],
  fields: Array<{ text: string; weight: number }>,
): { score: number; matched: string[]; distinctiveMatches: number } {
  let score = 0;
  const matched = new Set<string>();
  let distinctiveMatches = 0;

  for (const term of terms) {
    let termHit = false;
    for (const field of fields) {
      const hay = field.text.toLowerCase();
      if (haystackIncludes(hay, term)) {
        score += termWeight(field.weight, term);
        matched.add(term);
        termHit = true;
      }
    }
    if (termHit && !GENERIC_TERMS.has(term)) {
      distinctiveMatches += 1;
    }
  }

  return { score, matched: [...matched], distinctiveMatches };
}

function passesRelevance(
  score: number,
  distinctiveMatches: number,
  requireDistinctive: boolean,
): boolean {
  if (score < RELEVANCE_FLOOR) return false;
  if (requireDistinctive && distinctiveMatches === 0) return false;
  return true;
}

function factsHaystack(facts: Record<string, unknown>): string {
  return Object.entries(facts)
    .flatMap(([k, v]) => [k, String(v ?? "")])
    .join(" ");
}

function rankEvidence(
  items: Evidence[],
  terms: string[],
  dimensionHints: string[],
  requireDistinctive: boolean,
): RankedItem<Evidence>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.title, weight: WEIGHTS.title },
        { text: item.contentSummary, weight: WEIGHTS.summary },
        { text: item.dimension, weight: WEIGHTS.dimension },
        { text: item.sourceSystem, weight: WEIGHTS.sourceSystem },
        { text: factsHaystack(item.extractedFacts), weight: WEIGHTS.factKey },
      ]);

      let score = base;
      if (dimensionHints.includes(item.dimensionId)) {
        score += WEIGHTS.dimensionHint;
        matched.push("dimension-hint");
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.evidence)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function rankFindings(
  items: Finding[],
  terms: string[],
  dimensionHints: string[],
  requireDistinctive: boolean,
): RankedItem<Finding>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.title, weight: WEIGHTS.title },
        { text: item.description, weight: WEIGHTS.summary },
        { text: item.summary, weight: WEIGHTS.summary },
        { text: item.dimension, weight: WEIGHTS.dimension },
        { text: item.evidenceIds.join(" "), weight: WEIGHTS.linkedEvidence },
      ]);

      let score = base;
      if (dimensionHints.includes(item.dimensionId)) {
        score += WEIGHTS.dimensionHint;
        matched.push("dimension-hint");
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.findings)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function rankRisks(
  items: Risk[],
  terms: string[],
  dimensionHints: string[],
  explainRiskId: string | undefined,
  requireDistinctive: boolean,
): RankedItem<Risk>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.title, weight: WEIGHTS.title },
        { text: item.summary, weight: WEIGHTS.summary },
        { text: item.whyItMatters, weight: WEIGHTS.summary },
        { text: item.dimension, weight: WEIGHTS.dimension },
        { text: item.recommendation, weight: WEIGHTS.summary },
        { text: item.evidenceIds.join(" "), weight: WEIGHTS.linkedEvidence },
      ]);

      let score = base;
      let distinctive = distinctiveMatches;
      if (dimensionHints.includes(item.dimensionId)) {
        score += WEIGHTS.dimensionHint;
        matched.push("dimension-hint");
        distinctive += 1;
      }
      if (item.severity === "high") {
        score += WEIGHTS.severityHigh;
      }
      if (explainRiskId && item.id === explainRiskId) {
        score += WEIGHTS.explainRiskBoost;
        matched.push("explain-risk");
        distinctive += 1;
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches: distinctive,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.risks)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function rankRecommendations(
  items: Recommendation[],
  terms: string[],
  dimensionHints: string[],
  requireDistinctive: boolean,
): RankedItem<Recommendation>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.title, weight: WEIGHTS.title },
        { text: item.description, weight: WEIGHTS.summary },
        { text: item.rationale, weight: WEIGHTS.summary },
        { text: item.dimension, weight: WEIGHTS.dimension },
        { text: item.nextSteps.join(" "), weight: WEIGHTS.summary },
        { text: item.evidenceIds.join(" "), weight: WEIGHTS.linkedEvidence },
      ]);

      let score = base;
      let distinctive = distinctiveMatches;
      if (dimensionHints.includes(item.dimensionId)) {
        score += WEIGHTS.dimensionHint;
        matched.push("dimension-hint");
        distinctive += 1;
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches: distinctive,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.recommendations)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function rankDimensions(
  items: HealthDimension[],
  terms: string[],
  dimensionHints: string[],
  requireDistinctive: boolean,
): RankedItem<HealthDimension>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.name, weight: WEIGHTS.title },
        { text: item.summary, weight: WEIGHTS.summary },
        { text: item.whyItMatters, weight: WEIGHTS.summary },
        { text: item.topDrivers.join(" "), weight: WEIGHTS.summary },
        { text: String(item.score), weight: 1 },
      ]);

      let score = base;
      let distinctive = distinctiveMatches;
      if (dimensionHints.includes(item.id)) {
        score += WEIGHTS.dimensionHint + WEIGHTS.intentBoost;
        matched.push("dimension-hint");
        distinctive += 1;
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches: distinctive,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.dimensions)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function rankTimeline(
  items: TimelineEvent[],
  terms: string[],
  dimensionHints: string[],
  requireDistinctive: boolean,
): RankedItem<TimelineEvent>[] {
  return items
    .map((item) => {
      const { score: base, matched, distinctiveMatches } = scoreTextFields(terms, [
        { text: item.id, weight: WEIGHTS.idExact },
        { text: item.title, weight: WEIGHTS.title },
        { text: item.description, weight: WEIGHTS.summary },
        { text: item.type, weight: 1.5 },
        { text: item.dimension ?? "", weight: WEIGHTS.dimension },
        { text: item.whyHealthChanged ?? "", weight: WEIGHTS.summary },
      ]);

      let score = base;
      let distinctive = distinctiveMatches;
      if (item.dimensionId && dimensionHints.includes(item.dimensionId)) {
        score += WEIGHTS.dimensionHint * 0.5;
        matched.push("dimension-hint");
        distinctive += 1;
      }

      return {
        item,
        score,
        matchedTerms: uniqueTerms(matched),
        distinctiveMatches: distinctive,
      };
    })
    .filter((r) =>
      passesRelevance(r.score, r.distinctiveMatches, requireDistinctive),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, LIMITS.timeline)
    .map(({ item, score, matchedTerms }) => ({ item, score, matchedTerms }));
}

function intentTerms(query: ClassifiedQuery): string[] {
  const extras: string[] = [...query.boostTerms];

  switch (query.intent) {
    case "risks":
      extras.push("risk", "severity");
      break;
    case "customer_concentration":
      extras.push("concentration", "customer", "arr", "cohort");
      break;
    case "governance":
      extras.push("governance", "board", "approval", "grants");
      break;
    case "fundraising":
      extras.push("risk", "governance", "legal", "concentration");
      break;
    case "board_update":
      extras.push("health", "risk", "board");
      break;
    case "recommendations":
      extras.push("recommendation", "action", "fix");
      break;
    case "health":
      extras.push("health", "score", "dimension");
      break;
    case "financial":
      extras.push(
        "revenue",
        "runway",
        "burn",
        "cash",
        "margin",
        "ebitda",
        "growth",
        "financial",
      );
      break;
    default:
      break;
  }

  return uniqueTerms([...query.tokens, ...extras]);
}

/**
 * Deterministic keyword + weighted relevance retrieval over the Insight Engine snapshot.
 * No embeddings — ranking is stable across runs for the same question + snapshot.
 */
export function retrieveRelevantContext(
  snapshot: CompanyHealthSnapshot,
  query: ClassifiedQuery,
  options?: { explainRiskId?: string },
): RetrievalResult {
  if (query.intent === "unsupported") {
    return {
      evidence: [],
      findings: [],
      risks: [],
      recommendations: [],
      dimensions: [],
      timeline: [],
      structuredFacts: [],
      insufficientEvidence: true,
      topScore: 0,
      snapshotId: snapshot.assessmentSnapshotId ?? null,
    };
  }

  const terms = intentTerms(query);
  const dimensionHints = query.dimensionHints;
  // General / weak queries must match at least one non-generic token.
  const requireDistinctive =
    query.intent === "general" || query.dimensionHints.length === 0;

  const evidence = rankEvidence(
    snapshot.evidence,
    terms,
    dimensionHints,
    requireDistinctive && query.intent === "general",
  );
  const findings = rankFindings(
    snapshot.findings,
    terms,
    dimensionHints,
    requireDistinctive && query.intent === "general",
  );
  const risks = rankRisks(
    snapshot.risks,
    terms,
    dimensionHints,
    options?.explainRiskId,
    requireDistinctive && query.intent === "general",
  );
  const recommendations = rankRecommendations(
    snapshot.recommendations,
    terms,
    dimensionHints,
    requireDistinctive && query.intent === "general",
  );
  const dimensions = rankDimensions(
    snapshot.dimensions,
    terms,
    dimensionHints,
    requireDistinctive && query.intent === "general",
  );
  const timeline = rankTimeline(
    snapshot.timeline,
    terms,
    dimensionHints,
    requireDistinctive && query.intent === "general",
  );

  const structuredFacts = collectStructuredFinancialFacts(snapshot).map((f) => ({
    key: f.key,
    value: f.value,
    evidenceId: f.evidenceId,
    evidenceTitle: f.evidenceTitle,
    worksheet: f.worksheet,
    period: f.period,
  }));

  // Always surface financial evidence that carries structured facts for
  // diagnosis / risk / financial intents — findings are not required.
  const financialIntents = new Set([
    "risks",
    "financial",
    "fundraising",
    "recommendations",
    "health",
  ]);
  if (financialIntents.has(query.intent) && structuredFacts.length > 0) {
    const factEvidenceIds = new Set(structuredFacts.map((f) => f.evidenceId));
    for (const e of snapshot.evidence) {
      if (!factEvidenceIds.has(e.id)) continue;
      if (evidence.some((r) => r.item.id === e.id)) continue;
      evidence.push({
        item: e,
        score: RELEVANCE_FLOOR + 3,
        matchedTerms: ["structured-financial-facts"],
      });
    }
    if (
      query.dimensionHints.includes("dim-financial") ||
      query.intent === "financial" ||
      query.intent === "risks"
    ) {
      const finDim = snapshot.dimensions.find((d) => d.id === "dim-financial");
      if (finDim && !dimensions.some((d) => d.item.id === finDim.id)) {
        dimensions.push({
          item: finDim,
          score: RELEVANCE_FLOOR + 2,
          matchedTerms: ["financial-dimension-fallback"],
        });
      }
    }
  }

  // Intent-specific fallbacks: ensure core entities surface for known intents
  if (query.intent === "risks" && risks.length === 0) {
    const fallback = [...snapshot.risks]
      .sort((a, b) => {
        const sev = { high: 3, medium: 2, low: 1 } as const;
        return sev[b.severity] - sev[a.severity] || a.id.localeCompare(b.id);
      })
      .slice(0, LIMITS.risks)
      .map((item) => ({
        item,
        score: RELEVANCE_FLOOR + (item.severity === "high" ? 2 : 1),
        matchedTerms: ["intent-risks-fallback"],
      }));
    risks.push(...fallback);
  }

  if (query.intent === "board_update" || query.intent === "health") {
    if (dimensions.length === 0) {
      const lowest = [...snapshot.dimensions]
        .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
        .slice(0, 3)
        .map((item) => ({
          item,
          score: RELEVANCE_FLOOR + 1,
          matchedTerms: ["intent-health-fallback"],
        }));
      dimensions.push(...lowest);
    }
  }

  const allScores = [
    ...evidence,
    ...findings,
    ...risks,
    ...recommendations,
    ...dimensions,
    ...timeline,
  ].map((r) => r.score);

  const topScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const factsSupportIntent =
    financialIntents.has(query.intent) ||
    query.dimensionHints.includes("dim-financial");
  const hasMaterialSupport =
    evidence.length > 0 ||
    findings.length > 0 ||
    risks.length > 0 ||
    (factsSupportIntent && structuredFacts.length > 0) ||
    (query.intent === "health" && dimensions.length > 0);

  return {
    evidence,
    findings,
    risks,
    recommendations,
    dimensions,
    timeline,
    structuredFacts: factsSupportIntent ? structuredFacts : [],
    insufficientEvidence:
      !hasMaterialSupport ||
      (topScore < RELEVANCE_FLOOR &&
        !(factsSupportIntent && structuredFacts.length > 0)),
    topScore:
      factsSupportIntent && structuredFacts.length > 0
        ? Math.max(topScore, RELEVANCE_FLOOR + 1)
        : topScore,
    snapshotId: snapshot.assessmentSnapshotId ?? null,
  };
}
