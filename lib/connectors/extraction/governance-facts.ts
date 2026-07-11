/**
 * Structured governance fact extraction from board minutes / consents.
 *
 * Only emits typed facts when real governance language is present.
 * Never invents a healthy Governance score from document presence alone.
 */

import type { ExtractedFacts } from "@/lib/domain";
import type { ExtractedDocument } from "../extraction/types";

/** Canonical governance fact keys understood by the analyzer. */
export const GOVERNANCE_FACT_KEYS = [
  "boardApprovalsDocumented",
  "directorElectionsDocumented",
  "financingApprovalsDocumented",
  "optionGrantsApproved",
  "optionGrantsMissingBoardApproval",
  "corporateActionsDocumented",
  "writtenConsentDocumented",
  "governanceCadenceDocumented",
  "materialActionsMissingBoardApproval",
  "boardMeetingDate",
  "approvedItems",
] as const;

export type GovernanceFactKey = (typeof GOVERNANCE_FACT_KEYS)[number];

/** Minimum distinct governance facts required before Governance can be scored. */
export const MIN_GOVERNANCE_FACTS_TO_SCORE = 2;

const META_KEYS = new Set([
  "governanceFactKeys",
  "governanceFactCount",
  "governanceFactsComplete",
  "governanceExtractionSource",
  "extractionQuality",
]);

export function countGovernanceFacts(facts: ExtractedFacts): number {
  let n = 0;
  for (const key of GOVERNANCE_FACT_KEYS) {
    if (META_KEYS.has(key)) continue;
    const v = facts[key];
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "boolean" && v === false) continue;
    if (typeof v === "number" && v === 0 && key !== "optionGrantsMissingBoardApproval") {
      // zero missing grants is still a meaningful fact
    }
    n++;
  }
  return n;
}

export function hasEnoughGovernanceFacts(facts: ExtractedFacts): boolean {
  return countGovernanceFacts(facts) >= MIN_GOVERNANCE_FACTS_TO_SCORE;
}

function collectText(extracted: ExtractedDocument): string {
  return [extracted.title, extracted.text, ...extracted.sections.map((s) => s.text)]
    .filter(Boolean)
    .join("\n");
}

function pushUnique(list: string[], item: string) {
  const t = item.trim();
  if (!t) return;
  if (!list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t);
}

/**
 * Parse board-minutes / written-consent prose into typed governance facts.
 */
export function extractGovernanceFactsFromText(text: string): ExtractedFacts {
  const facts: ExtractedFacts = {};
  const approvedItems: string[] = [];
  const t = text;

  const isMinutes =
    /\b(board\s+(of\s+directors\s+)?minutes|minutes\s+of\s+(?:a\s+)?(?:special\s+|regular\s+)?meeting|written\s+consent)\b/i.test(
      t,
    ) || /\bdirectors?\s+present\b/i.test(t);

  const isConsent = /\bwritten\s+consent\b/i.test(t);
  if (isConsent) {
    facts.writtenConsentDocumented = true;
  }

  // Meeting date
  const dateMatch =
    /\b(?:date|held\s+on|meeting\s+date)\s*:?\s*([A-Z][a-z]+ \d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i.exec(
      t,
    ) ??
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i.exec(
      t,
    );
  if (dateMatch?.[1]) {
    facts.boardMeetingDate = dateMatch[1].trim();
    facts.governanceCadenceDocumented = true;
  } else if (/\b(quarterly|regular)\s+board\s+meeting\b/i.test(t)) {
    facts.governanceCadenceDocumented = true;
  }

  // Director elections
  if (
    /\b(elect(?:ed|ion)?|appoint(?:ed|ment)?)\b.{0,40}\b(director|board\s+member)\b/i.test(
      t,
    ) ||
    /\b(director|board\s+member)\b.{0,40}\b(elect(?:ed|ion)?|appoint(?:ed|ment)?)\b/i.test(
      t,
    )
  ) {
    facts.directorElectionsDocumented = true;
    pushUnique(approvedItems, "Director election");
  }

  // Financing approvals
  if (
    /\b(approv(?:e|ed|al)|authoriz(?:e|ed|ation))\b.{0,60}\b(financ(?:e|ing)|safe|note|equity\s+round|series\s+[a-z]|debt\s+facility|loan)\b/i.test(
      t,
    ) ||
    /\b(financ(?:e|ing)|safe|series\s+[a-z])\b.{0,60}\b(approv(?:e|ed|al)|authoriz(?:e|ed))\b/i.test(
      t,
    )
  ) {
    facts.financingApprovalsDocumented = true;
    facts.boardApprovalsDocumented = true;
    pushUnique(approvedItems, "Financing approval");
  }

  // Option grants — approved vs missing
  const grantApproved =
    /\b(approv(?:e|ed|al)|authoriz(?:e|ed))\b.{0,50}\b(option\s+grant|equity\s+grant|stock\s+option)\b/i.test(
      t,
    ) ||
    /\b(option\s+grant|equity\s+grant|stock\s+option)s?\b.{0,50}\b(approv(?:e|ed|al)|authoriz(?:e|ed))\b/i.test(
      t,
    );
  const grantMissing =
    /\b(option\s+grant|equity\s+grant)s?\b.{0,80}\b(without|pending|missing|lacking|no)\b.{0,40}\b(board\s+)?approv/i.test(
      t,
    ) ||
    /\b(without|pending|missing|lacking)\b.{0,40}\b(board\s+)?approv.{0,40}\b(option\s+grant|equity\s+grant)/i.test(
      t,
    );

  const grantCount =
    /\b(\d+)\s+option\s+grants?\b/i.exec(t) ??
    /\boption\s+grants?\s*(?:of|:)?\s*(\d+)\b/i.exec(t);

  if (grantMissing) {
    const n = grantCount?.[1] ? Number(grantCount[1]) : 1;
    facts.optionGrantsMissingBoardApproval = Number.isFinite(n) ? n : 1;
    facts.materialActionsMissingBoardApproval = true;
  } else if (grantApproved) {
    facts.optionGrantsApproved = true;
    facts.boardApprovalsDocumented = true;
    facts.optionGrantsMissingBoardApproval = 0;
    pushUnique(approvedItems, "Option grant approval");
  }

  // Corporate actions
  if (
    /\b(merger|acquisition|dissolution|amend(?:ment|ed)\s+(?:the\s+)?(?:certificate|bylaws)|corporate\s+action|stock\s+split|dividend)\b/i.test(
      t,
    )
  ) {
    facts.corporateActionsDocumented = true;
    facts.boardApprovalsDocumented = true;
    pushUnique(approvedItems, "Corporate action");
  }

  // Generic board approvals / resolutions
  if (
    /\b(resolv(?:e|ed)|resolution|upon\s+motion|duly\s+approved|board\s+approv(?:ed|al)| unanimously\s+approved)\b/i.test(
      t,
    )
  ) {
    facts.boardApprovalsDocumented = true;
    // Capture short approved item lines
    const itemLines =
      t.match(
        /(?:^|\n)\s*[-•*]?\s*((?:Approved|Authorization|Resolved)[^\n.]{5,80})/gi,
      ) ?? [];
    for (const line of itemLines.slice(0, 8)) {
      pushUnique(approvedItems, line.replace(/^[\s\-•*]+/, "").trim());
    }
  }

  // Missing material approvals (explicit language)
  if (
    /\b(material\s+action|financ(?:e|ing)|option\s+grant).{0,60}\b(missing|without|lacking|no)\b.{0,30}\b(board\s+)?approv/i.test(
      t,
    ) ||
    /\b(missing|without|lacking)\b.{0,30}\bboard\s+approv.{0,40}\b(material|financ|grant)/i.test(
      t,
    )
  ) {
    facts.materialActionsMissingBoardApproval = true;
  }

  if (approvedItems.length > 0) {
    facts.approvedItems = approvedItems;
  }

  // Only treat as governance extraction when we saw minutes/consent context
  // or at least one strong governance signal.
  const strong =
    isMinutes ||
    isConsent ||
    facts.boardApprovalsDocumented === true ||
    facts.directorElectionsDocumented === true ||
    facts.financingApprovalsDocumented === true ||
    facts.optionGrantsApproved === true ||
    typeof facts.optionGrantsMissingBoardApproval === "number" ||
    facts.corporateActionsDocumented === true ||
    facts.writtenConsentDocumented === true;

  if (!strong) {
    return {};
  }

  const keys = GOVERNANCE_FACT_KEYS.filter((k) => facts[k] != null);
  facts.governanceFactKeys = keys;
  facts.governanceFactCount = countGovernanceFacts(facts);
  facts.governanceFactsComplete =
    countGovernanceFacts(facts) >= MIN_GOVERNANCE_FACTS_TO_SCORE;
  facts.governanceExtractionSource = "board-minutes-text";

  return facts;
}

export function mergeGovernanceFactsInto(
  facts: ExtractedFacts,
  extracted: ExtractedDocument,
): { facts: ExtractedFacts; added: number } {
  const text = collectText(extracted);
  const gov = extractGovernanceFactsFromText(text);
  if (Object.keys(gov).length === 0) {
    return { facts, added: 0 };
  }
  let added = 0;
  const merged: ExtractedFacts = { ...facts };
  for (const [k, v] of Object.entries(gov)) {
    if (merged[k] == null || merged[k] === "") {
      merged[k] = v;
      if ((GOVERNANCE_FACT_KEYS as readonly string[]).includes(k)) added++;
    }
  }
  // Prefer freshly computed meta
  if (gov.governanceFactKeys) merged.governanceFactKeys = gov.governanceFactKeys;
  if (gov.governanceFactCount != null) {
    merged.governanceFactCount = gov.governanceFactCount;
  }
  if (gov.governanceFactsComplete != null) {
    merged.governanceFactsComplete = gov.governanceFactsComplete;
  }
  if (gov.governanceExtractionSource) {
    merged.governanceExtractionSource = gov.governanceExtractionSource;
  }
  return { facts: merged, added };
}
