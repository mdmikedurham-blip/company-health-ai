import { DIMENSION_NAMES, dimensionIdFromName } from "@/lib/domain";
import type { ClassifiedQuery, DoctorQueryIntent } from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "but",
  "with",
  "from",
  "by",
  "at",
  "as",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "my",
  "our",
  "your",
  "me",
  "we",
  "you",
  "i",
  "only",
  "about",
  "any",
  "all",
  "me",
  "please",
  "tell",
  "show",
  "give",
  "generate",
]);

const INTENT_PATTERNS: Array<{
  intent: DoctorQueryIntent;
  patterns: RegExp[];
  boostTerms: string[];
  dimensionHints?: string[];
}> = [
  {
    intent: "customer_concentration",
    patterns: [
      /\bcustomer\s+concentration\b/,
      /\bconcentration\b/,
      /\btop\s*-?\s*3\b/,
      /\btop\s+customers?\b/,
      /\barr\s+share\b/,
      /\brevenue\s+concentration\b/,
      /\bmeridian\b/,
    ],
    boostTerms: [
      "concentration",
      "customer",
      "arr",
      "cohort",
      "top",
      "meridian",
      "diversify",
    ],
    dimensionHints: ["dim-customer"],
  },
  {
    intent: "governance",
    patterns: [
      /\bgovernance\b/,
      /\bboard\s+approval/,
      /\boption\s+grants?\b/,
      /\bequity\s+grants?\b/,
      /\bcarta\b/,
      /\bunanimous\s+written\s+consent\b/,
      /\bboard\s+consent/,
    ],
    boostTerms: [
      "governance",
      "board",
      "approval",
      "option",
      "grants",
      "equity",
      "carta",
      "consent",
    ],
    dimensionHints: ["dim-governance"],
  },
  {
    intent: "fundraising",
    patterns: [
      /\bfundrais/,
      /\bbefore\s+(a\s+)?raise\b/,
      /\binvestor\s+ready/,
      /\bdue\s+diligence\b/,
      /\bseries\s+[a-c]\b/,
    ],
    boostTerms: [
      "fundraising",
      "investor",
      "risk",
      "governance",
      "legal",
      "concentration",
      "board",
    ],
    dimensionHints: ["dim-governance", "dim-legal", "dim-customer", "dim-financial"],
  },
  {
    intent: "board_update",
    patterns: [
      /\bboard\s+update\b/,
      /\bboard\s+deck\b/,
      /\bboard\s+brief\b/,
      /\bexecutive\s+brief\b/,
      /\bboard\s+report\b/,
    ],
    boostTerms: ["board", "update", "health", "risk", "brief"],
  },
  {
    intent: "financial",
    patterns: [
      /\brunway\b/,
      /\bcash\s+burn\b/,
      /\bburn\s+rate\b/,
      /\brevenue\s+(declin|slow|growth)/,
      /\bgross\s+margin\b/,
      /\bebitda\b/,
      /\bfinancial(s)?\b/,
      /\bwhat\s+needs\s+fixing\b/,
      /\bneeds\s+fixing\b/,
      /\bis\s+runway\s+short/,
    ],
    boostTerms: [
      "runway",
      "burn",
      "cash",
      "revenue",
      "margin",
      "ebitda",
      "growth",
      "financial",
    ],
    dimensionHints: ["dim-financial"],
  },
  {
    intent: "risks",
    patterns: [
      /\bbiggest\s+risks?\b/,
      /\btop\s+risks?\b/,
      /\bwhat\s+are\s+the\s+risks?\b/,
      /\bwhat\s+is\s+my\s+biggest\s+risk\b/,
      /\bmy\s+biggest\s+risk\b/,
      /\brisk\s+overview\b/,
      /\bactive\s+risks?\b/,
    ],
    boostTerms: ["risk", "severity", "high", "medium", "runway", "financial"],
    dimensionHints: ["dim-financial"],
  },
  {
    intent: "recommendations",
    patterns: [
      /\bwhat\s+should\s+i\s+fix\b/,
      /\bnext\s+best\s+actions?\b/,
      /\brecommend/,
      /\bpriorit/,
      /\bwhat\s+to\s+fix\b/,
    ],
    boostTerms: ["recommendation", "action", "fix", "priority"],
  },
  {
    intent: "evidence",
    patterns: [
      /\bshow\s+evidence\b/,
      /\bevidence\s+for\b/,
      /\bcite\b/,
      /\bsource\s+documents?\b/,
      /\bwhich\s+documents?\b/,
    ],
    boostTerms: ["evidence", "document", "source"],
  },
  {
    intent: "health",
    patterns: [
      /\bhealth\s+score\b/,
      /\bcompany\s+health\b/,
      /\boverall\s+score\b/,
      /\bdimension\s+scores?\b/,
      /\bhow\s+healthy\b/,
    ],
    boostTerms: ["health", "score", "dimension", "confidence"],
  },
];

/** Questions clearly outside company-health scope. */
const UNSUPPORTED_PATTERNS: RegExp[] = [
  /\bweather\b/,
  /\brecipe\b/,
  /\bcook\b/,
  /\bjoke\b/,
  /\bcapital\s+of\b/,
  /\bwho\s+won\s+the\s+(super\s+bowl|world\s+cup|election)\b/,
  /\bwrite\s+(me\s+)?(a\s+)?poem\b/,
  /\btranslate\b/,
  /\bpython\s+code\b/,
  /\bbitcoin\s+price\b/,
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function detectDimensionHints(normalized: string, tokens: string[]): string[] {
  const hints = new Set<string>();

  for (const [id, name] of Object.entries(DIMENSION_NAMES)) {
    const label = name.toLowerCase();
    if (normalized.includes(label) || tokens.includes(label.split(" ")[0]!)) {
      hints.add(id);
    }
  }

  // Score-style questions: "why is governance only 71"
  const scoreMatch = normalized.match(
    /\b(why\s+is\s+)?([a-z ]+?)\s+(only\s+)?\d{1,3}\b/,
  );
  if (scoreMatch?.[2]) {
    const dimId = dimensionIdFromName(scoreMatch[2].trim());
    if (dimId) hints.add(dimId);
  }

  return [...hints];
}

function matchIntent(
  normalized: string,
): { intent: DoctorQueryIntent; boostTerms: string[]; dimensionHints: string[] } {
  if (UNSUPPORTED_PATTERNS.some((p) => p.test(normalized))) {
    return { intent: "unsupported", boostTerms: [], dimensionHints: [] };
  }

  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some((p) => p.test(normalized))) {
      return {
        intent: entry.intent,
        boostTerms: entry.boostTerms,
        dimensionHints: entry.dimensionHints ?? [],
      };
    }
  }

  return { intent: "general", boostTerms: [], dimensionHints: [] };
}

/**
 * Classify a free-text Company Doctor question into intent + retrieval hints.
 * Deterministic — no LLM.
 */
export function classifyQuery(question: string): ClassifiedQuery {
  const trimmed = question.trim();
  const normalizedQuestion = trimmed.toLowerCase().replace(/\s+/g, " ");
  const tokens = tokenize(normalizedQuestion);
  const matched = matchIntent(normalizedQuestion);
  const dimensionHints = [
    ...new Set([
      ...matched.dimensionHints,
      ...detectDimensionHints(normalizedQuestion, tokens),
    ]),
  ];

  // Governance score questions without the word "governance" in patterns already covered
  if (
    matched.intent === "general" &&
    dimensionHints.includes("dim-governance") &&
    /\b\d{1,3}\b/.test(normalizedQuestion)
  ) {
    return {
      question: trimmed,
      normalizedQuestion,
      tokens,
      intent: "governance",
      dimensionHints,
      boostTerms: [
        "governance",
        "board",
        "approval",
        "option",
        "grants",
        "equity",
        ...matched.boostTerms,
      ],
    };
  }

  return {
    question: trimmed,
    normalizedQuestion,
    tokens,
    intent: matched.intent,
    dimensionHints,
    boostTerms: matched.boostTerms,
  };
}
