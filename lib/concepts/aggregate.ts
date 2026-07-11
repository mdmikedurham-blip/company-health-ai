/**
 * Aggregate Evidence facts into Business Concepts.
 * Deterministic — never invents concepts outside the catalog.
 */

import type { Evidence } from "@/lib/domain";
import type {
  BusinessConcept,
  BusinessConceptState,
} from "@/lib/domain/business-concept";
import {
  CONCENTRATION_HIGH,
  CONCENTRATION_MEDIUM,
  MFA_COVERAGE_THRESHOLD,
  NRR_RISK_THRESHOLD,
  RUNWAY_MEDIUM_RISK,
  asBoolean,
  asNumber,
  asRatio,
  asStringArray,
} from "@/lib/intelligence/rules";
import {
  BUSINESS_CONCEPT_CATALOG,
  canonicalFactKey,
} from "./catalog";

function documentIdFromEvidence(evidence: Evidence): string | null {
  const meta = evidence.metadata as Record<string, unknown> | undefined;
  const fromMeta =
    (typeof meta?.document_id === "string" && meta.document_id) ||
    (typeof meta?.documentId === "string" && meta.documentId) ||
    null;
  if (fromMeta) return fromMeta;
  const citation = evidence.citation as { documentId?: string } | undefined;
  return citation?.documentId ?? null;
}

function factId(evidenceId: string, factKey: string): string {
  return `${evidenceId}::${factKey}`;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function isContradictingValue(factKey: string, value: unknown): boolean {
  const key = canonicalFactKey(factKey);
  if (key === "cashRunwayMonths") {
    const n = asNumber(value);
    return n !== null && n < RUNWAY_MEDIUM_RISK;
  }
  if (key === "top3CustomerArrShare") {
    const n = asRatio(value);
    return n !== null && n >= CONCENTRATION_MEDIUM;
  }
  if (key === "netRevenueRetention") {
    const n = asRatio(value);
    return n !== null && n < NRR_RISK_THRESHOLD;
  }
  if (key === "openCriticalControls") {
    const n = asNumber(value);
    return n !== null && n > 0;
  }
  if (key === "mfaCoverage") {
    const n = asRatio(value);
    return n !== null && n < MFA_COVERAGE_THRESHOLD;
  }
  if (key === "agreementsMissingIpAssignment") {
    const n = asNumber(value);
    return n !== null && n > 0;
  }
  if (key === "optionGrantsMissingBoardApproval") {
    const n = asNumber(value);
    return n !== null && n > 0;
  }
  if (key === "materialActionsMissingBoardApproval") {
    return asBoolean(value) === true;
  }
  if (key === "singleOwnerCriticalFunctions") {
    return asStringArray(value).length > 0;
  }
  return false;
}

/**
 * Build one BusinessConcept per catalog entry from company evidence.
 * Concepts with zero mapped facts → state unknown (not hallucinated as healthy).
 */
export function aggregateBusinessConcepts(input: {
  companyId: string;
  evidence: Evidence[];
  snapshotId?: string | null;
  asOf?: string;
}): BusinessConcept[] {
  const asOf = input.asOf ?? new Date().toISOString();
  const concepts: BusinessConcept[] = [];

  for (const def of BUSINESS_CONCEPT_CATALOG) {
    const supportingEvidenceIds = new Set<string>();
    const contradictingEvidenceIds = new Set<string>();
    const supportingFactKeys = new Set<string>();
    const contradictingFactKeys = new Set<string>();
    const supportingFactIds = new Set<string>();
    const supportingDocumentIds = new Set<string>();
    const factValues: BusinessConcept["factValues"] = {};
    const reliabilities: number[] = [];

    const canonicalKeys = [...new Set(def.factKeys.map(canonicalFactKey))];

    for (const evidence of input.evidence) {
      const facts = evidence.extractedFacts ?? {};
      let touched = false;

      for (const rawKey of Object.keys(facts)) {
        const canonical = canonicalFactKey(rawKey);
        if (!canonicalKeys.includes(canonical) && !def.factKeys.includes(rawKey)) {
          continue;
        }
        const value = facts[rawKey];
        if (!isPresent(value)) continue;

        touched = true;
        supportingEvidenceIds.add(evidence.id);
        supportingFactKeys.add(canonical);
        supportingFactIds.add(factId(evidence.id, canonical));
        const docId = documentIdFromEvidence(evidence);
        if (docId) supportingDocumentIds.add(docId);
        reliabilities.push(evidence.reliability);

        // Prefer first non-null; later evidence can overwrite with same key.
        factValues[canonical] = value as BusinessConcept["factValues"][string];
        if (rawKey !== canonical) {
          factValues[rawKey] = value as BusinessConcept["factValues"][string];
        }

        if (isContradictingValue(rawKey, value)) {
          contradictingEvidenceIds.add(evidence.id);
          contradictingFactKeys.add(canonical);
        }
      }

      if (touched) {
        // already tracked
      }
    }

    const presentKeyCount = supportingFactKeys.size;
    const coverage =
      canonicalKeys.length === 0
        ? 0
        : Math.round((presentKeyCount / canonicalKeys.length) * 1000) / 1000;

    const confidence =
      reliabilities.length === 0
        ? 0
        : Math.round(
            reliabilities.reduce((s, r) => s + r, 0) / reliabilities.length,
          );

    let state: BusinessConceptState = "unknown";
    if (presentKeyCount === 0) {
      state = "unknown";
    } else if (contradictingFactKeys.size > 0 && presentKeyCount > contradictingFactKeys.size) {
      state = "partial";
    } else if (contradictingFactKeys.size > 0) {
      state = "contradicted";
    } else if (coverage >= 0.5) {
      state = "supported";
    } else {
      state = "partial";
    }

    const reasoning =
      presentKeyCount === 0
        ? `No mapped facts observed for ${def.label}.`
        : contradictingFactKeys.size > 0
          ? `${def.label}: observed ${presentKeyCount}/${canonicalKeys.length} mapped facts; contradictions in ${[...contradictingFactKeys].join(", ")}.`
          : `${def.label}: observed ${presentKeyCount}/${canonicalKeys.length} mapped facts with no contradiction signals.`;

    concepts.push({
      conceptId: def.id,
      companyId: input.companyId,
      label: def.label,
      state,
      confidence,
      coverage,
      supportingEvidenceIds: [...supportingEvidenceIds],
      supportingFactKeys: [...supportingFactKeys],
      supportingFactIds: [...supportingFactIds],
      supportingDocumentIds: [...supportingDocumentIds],
      contradictingEvidenceIds: [...contradictingEvidenceIds],
      contradictingFactKeys: [...contradictingFactKeys],
      reasoning,
      lastUpdated: asOf,
      snapshotId: input.snapshotId ?? null,
      factValues,
    });
  }

  return concepts;
}

export function conceptsById(
  concepts: BusinessConcept[],
): Map<string, BusinessConcept> {
  return new Map(concepts.map((c) => [c.conceptId, c]));
}

/** Read a fact value from one or more concepts (never invents). */
export function readConceptFact(
  concepts: Map<string, BusinessConcept>,
  conceptIds: string[],
  factKey: string,
): {
  value: string | number | boolean | string[] | null | undefined;
  evidenceIds: string[];
  conceptIds: string[];
  confidence: number;
} {
  const canonical = canonicalFactKey(factKey);
  const evidenceIds = new Set<string>();
  const matchedConcepts: string[] = [];
  let value: string | number | boolean | string[] | null | undefined;
  let confidence = 0;

  for (const id of conceptIds) {
    const concept = concepts.get(id);
    if (!concept) continue;
    const v =
      concept.factValues[canonical] ??
      concept.factValues[factKey];
    if (!isPresent(v)) continue;
    value = v;
    matchedConcepts.push(id);
    for (const eid of concept.supportingEvidenceIds) evidenceIds.add(eid);
    confidence = Math.max(confidence, concept.confidence);
  }

  return {
    value,
    evidenceIds: [...evidenceIds],
    conceptIds: matchedConcepts,
    confidence,
  };
}

// Silence unused import if tree-shaken oddly
void CONCENTRATION_HIGH;
