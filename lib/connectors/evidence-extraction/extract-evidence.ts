import { DIMENSION_NAMES, type KnownDimensionId } from "@/lib/domain";
import type { ExtractedDocument } from "../extraction";
import type {
  EvidenceExtractionResult,
  EvidenceExtractionType,
  ExtractedAmount,
  ExtractedDate,
  ExtractedPerson,
  RecommendedFinding,
  SourceQuote,
} from "./types";

type DimensionHint = {
  dimensionId: KnownDimensionId;
  evidenceType: EvidenceExtractionType;
  keywords: RegExp;
  negative?: RegExp;
  positive?: RegExp;
};

const DIMENSION_HINTS: DimensionHint[] = [
  {
    dimensionId: "dim-financial",
    evidenceType: "financial",
    keywords:
      /\b(runway|cash|burn|arr|mrr|ebitda|balance\s*sheet|p&l|profit|loss|budget|forecast|raise|funding|valuation)\b/i,
    negative: /\b(runway\s*<|low\s+cash|cash\s+crunch|miss(ed)?\s+forecast|over\s*budget)\b/i,
    positive: /\b(runway\s*>|strong\s+cash|profitable|beat\s+forecast)\b/i,
  },
  {
    dimensionId: "dim-revenue-quality",
    evidenceType: "revenue",
    keywords:
      /\b(nrr|net\s+revenue\s+retention|recurring|churn|expansion|contraction|gross\s+margin|revenue\s+quality)\b/i,
    negative: /\b(churn|contraction|declin)/i,
    positive: /\b(expansion|nrr\s*>|retention\s*>)/i,
  },
  {
    dimensionId: "dim-customer",
    evidenceType: "customer",
    keywords:
      /\b(customer|logo|concentration|nps|csat|renewal|pipeline|deal|arr\s+share|top\s*3)\b/i,
    negative: /\b(churn|at[- ]risk|concentration|lost\s+logo)\b/i,
    positive: /\b(renewed|expansion|won|nps\s*>)/i,
  },
  {
    dimensionId: "dim-legal",
    evidenceType: "legal",
    keywords:
      /\b(ip\s+assignment|contractor|msa|nda|litigation|indemnif|agreement|contract|counsel)\b/i,
    negative: /\b(missing|unsigned|gap|dispute|litigation)\b/i,
    positive: /\b(executed|signed|assigned|cleared)\b/i,
  },
  {
    dimensionId: "dim-governance",
    evidenceType: "governance",
    keywords:
      /\b(board|minutes|option\s+grant|approval|director|cap\s*table|governance|consent)\b/i,
    negative: /\b(missing\s+approval|unapproved|no\s+board)\b/i,
    positive: /\b(approved|ratified|consented)\b/i,
  },
  {
    dimensionId: "dim-security",
    evidenceType: "security",
    keywords:
      /\b(security|mfa|soc\s*2|iso\s*27001|vulnerability|control|incident|pentest|access\s+review)\b/i,
    negative: /\b(open\s+critical|breach|unpatched|mfa\s+gap|failed)\b/i,
    positive: /\b(remediated|passed|certified|mfa\s+coverage)\b/i,
  },
  {
    dimensionId: "dim-people",
    evidenceType: "people",
    keywords:
      /\b(attrition|turnover|headcount|hiring|key[- ]person|owner|hr|people|retention)\b/i,
    negative: /\b(attrition|turnover|single[- ]owner|key[- ]person\s+risk)\b/i,
    positive: /\b(hired|retention|backfill)\b/i,
  },
  {
    dimensionId: "dim-operations",
    evidenceType: "operations",
    keywords:
      /\b(runbook|ops|operations|process|sla|incident\s+response|on[- ]call)\b/i,
  },
  {
    dimensionId: "dim-product",
    evidenceType: "product",
    keywords:
      /\b(roadmap|release|product|feature|uptime|latency|sla)\b/i,
  },
];

const AMOUNT_RE =
  /(?:USD|US\$|\$|€|£)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(%|k|m|b|million|billion|thousand)?\b/gi;

const ISO_DATE_RE = /\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/g;
const US_DATE_RE =
  /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.]?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi;

const PERSON_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b(?:\s*[,—(]\s*|\s+as\s+|\s+)(CEO|CFO|CTO|COO|VP|Director|Counsel|Founder|Board\s+Member|Engineer|Manager)s?\b/g;

const ROLE_AFTER_RE =
  /\b(CEO|CFO|CTO|COO|VP\s+[A-Za-z]+|General\s+Counsel|Board\s+Chair)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

function scoreHint(text: string, hint: DimensionHint): number {
  const matches = text.match(new RegExp(hint.keywords.source, "gi"));
  return matches?.length ?? 0;
}

function classify(
  text: string,
  title: string,
): { evidenceType: EvidenceExtractionType; dimensionId: KnownDimensionId; direction: RecommendedFinding["direction"] } {
  const corpus = `${title}\n${text}`;
  let best: DimensionHint = DIMENSION_HINTS[0]!;
  let bestScore = 0;

  for (const hint of DIMENSION_HINTS) {
    const score = scoreHint(corpus, hint);
    if (score > bestScore) {
      best = hint;
      bestScore = score;
    }
  }

  if (bestScore === 0) {
    return {
      evidenceType: "general",
      dimensionId: "dim-governance",
      direction: "neutral",
    };
  }

  let direction: RecommendedFinding["direction"] = "neutral";
  if (best.negative?.test(corpus)) direction = "negative";
  else if (best.positive?.test(corpus)) direction = "positive";

  return {
    evidenceType: best.evidenceType,
    dimensionId: best.dimensionId,
    direction,
  };
}

function extractDates(text: string): ExtractedDate[] {
  const out: ExtractedDate[] = [];
  const seen = new Set<string>();

  for (const re of [ISO_DATE_RE, US_DATE_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0]!;
      if (seen.has(raw)) continue;
      seen.add(raw);
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + raw.length + 40);
      out.push({
        raw,
        iso: toIsoDate(raw),
        context: text.slice(start, end).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return out.slice(0, 20);
}

function toIsoDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractAmounts(text: string): ExtractedAmount[] {
  const out: ExtractedAmount[] = [];
  const seen = new Set<string>();
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const raw = m[0]!.trim();
    if (seen.has(raw) || raw.length < 2) continue;
    // Skip bare years / tiny integers without currency/% context
    const num = Number((m[1] ?? "").replace(/,/g, ""));
    const suffix = (m[2] ?? "").toLowerCase();
    const hasMoney = /\$|€|£|USD/i.test(raw) || /%|k|m|b|million|billion|thousand/i.test(suffix);
    if (!hasMoney && (num >= 1900 && num <= 2100)) continue;
    if (!hasMoney && num < 10) continue;
    seen.add(raw);

    let value = Number.isFinite(num) ? num : null;
    if (value !== null) {
      if (suffix === "%" ) {
        /* keep as percent number */
      } else if (suffix === "k" || suffix === "thousand") value *= 1_000;
      else if (suffix === "m" || suffix === "million") value *= 1_000_000;
      else if (suffix === "b" || suffix === "billion") value *= 1_000_000_000;
    }

    const currency = /€/.test(raw)
      ? "EUR"
      : /£/.test(raw)
        ? "GBP"
        : /\$|USD/i.test(raw)
          ? "USD"
          : suffix === "%"
            ? null
            : null;

    const start = Math.max(0, m.index - 40);
    const end = Math.min(text.length, m.index + raw.length + 40);
    out.push({
      raw,
      value,
      currency: suffix === "%" ? null : currency,
      context: text.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }
  return out.slice(0, 25);
}

function extractPeople(text: string): ExtractedPerson[] {
  const out: ExtractedPerson[] = [];
  const seen = new Set<string>();

  PERSON_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PERSON_RE.exec(text)) !== null) {
    const name = m[1]!;
    const role = m[2] ?? null;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0]!.length + 30);
    out.push({
      name,
      role,
      context: text.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }

  ROLE_AFTER_RE.lastIndex = 0;
  while ((m = ROLE_AFTER_RE.exec(text)) !== null) {
    const role = m[1]!;
    const name = m[2]!;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0]!.length + 30);
    out.push({
      name,
      role,
      context: text.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }

  return out.slice(0, 15);
}

function extractQuotes(doc: ExtractedDocument): SourceQuote[] {
  const quotes: SourceQuote[] = [];
  const sections =
    doc.sections.length > 0
      ? doc.sections
      : [{ id: null, title: null, text: doc.text, order: 1 }];

  for (const section of sections) {
    const sentences = section.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 40 && s.length <= 280);

    for (const sentence of sentences.slice(0, 2)) {
      quotes.push({
        text: sentence,
        sectionId: section.id ?? null,
        sectionTitle: section.title ?? null,
      });
    }
    if (quotes.length >= 8) break;
  }

  if (quotes.length === 0 && doc.text.trim()) {
    quotes.push({
      text: doc.text.trim().slice(0, 240),
      sectionId: doc.sections[0]?.id ?? null,
      sectionTitle: doc.sections[0]?.title ?? null,
    });
  }

  return quotes;
}

function buildFacts(
  doc: ExtractedDocument,
  dates: ExtractedDate[],
  amounts: ExtractedAmount[],
  people: ExtractedPerson[],
): string[] {
  const facts: string[] = [];
  facts.push(`Document title: ${doc.title}`);
  if (doc.metadata.format) facts.push(`Source format: ${String(doc.metadata.format)}`);
  if (doc.sections.length > 0) {
    facts.push(`Sections extracted: ${doc.sections.length}`);
  }
  for (const d of dates.slice(0, 3)) {
    facts.push(`Date referenced: ${d.raw}`);
  }
  for (const a of amounts.slice(0, 5)) {
    facts.push(`Amount referenced: ${a.raw}`);
  }
  for (const p of people.slice(0, 5)) {
    facts.push(p.role ? `Person: ${p.name} (${p.role})` : `Person: ${p.name}`);
  }

  // Keyword fact snippets from first meaningful lines
  for (const section of doc.sections.slice(0, 4)) {
    const line = section.text.split("\n").map((l) => l.trim()).find((l) => l.length > 20);
    if (line) facts.push(line.slice(0, 160));
  }

  return [...new Set(facts)].slice(0, 20);
}

function buildRecommendedFinding(
  title: string,
  evidenceType: EvidenceExtractionType,
  dimension: string,
  direction: RecommendedFinding["direction"],
  facts: string[],
  confidence: number,
): RecommendedFinding {
  const tone =
    direction === "negative"
      ? "Potential risk signal"
      : direction === "positive"
        ? "Positive signal"
        : "Observation";

  const detail = facts.find((f) => !f.startsWith("Document title") && !f.startsWith("Source format"))
    ?? facts[0]
    ?? title;

  return {
    title: `${tone}: ${title}`.slice(0, 120),
    description: `${dimension} ${evidenceType} evidence from “${title}”. ${detail}`.slice(0, 400),
    direction,
    materiality: Math.round(Math.min(90, Math.max(20, confidence * 0.9))),
  };
}

function computeConfidence(input: {
  textLength: number;
  dates: number;
  amounts: number;
  people: number;
  quotes: number;
  classified: boolean;
}): number {
  let score = 35;
  if (input.classified) score += 15;
  if (input.textLength > 200) score += 10;
  if (input.textLength > 1000) score += 5;
  score += Math.min(15, input.dates * 3);
  score += Math.min(15, input.amounts * 3);
  score += Math.min(10, input.people * 2);
  score += Math.min(10, input.quotes * 2);
  return Math.min(95, Math.max(20, score));
}

/**
 * Extract structured evidence JSON from an ExtractedDocument.
 * Deterministic / rules-based — LLM can replace this later with the same schema.
 */
export function extractEvidence(doc: ExtractedDocument): EvidenceExtractionResult {
  const text = doc.text || doc.sections.map((s) => s.text).join("\n\n");
  const { evidenceType, dimensionId, direction } = classify(text, doc.title);
  const dimension = DIMENSION_NAMES[dimensionId] ?? dimensionId;

  const dates = extractDates(text);
  const amounts = extractAmounts(text);
  const people = extractPeople(text);
  const sourceQuotes = extractQuotes(doc);
  const facts = buildFacts(doc, dates, amounts, people);
  const confidence = computeConfidence({
    textLength: text.length,
    dates: dates.length,
    amounts: amounts.length,
    people: people.length,
    quotes: sourceQuotes.length,
    classified: evidenceType !== "general",
  });

  return {
    evidenceType,
    dimension,
    confidence,
    facts,
    dates,
    amounts,
    people,
    sourceQuotes,
    recommendedFinding: buildRecommendedFinding(
      doc.title,
      evidenceType,
      dimension,
      direction,
      facts,
      confidence,
    ),
  };
}

/** Serialize evidence extraction as JSON only (pretty-printed). */
export function extractEvidenceJson(doc: ExtractedDocument): string {
  return JSON.stringify(extractEvidence(doc), null, 2);
}
