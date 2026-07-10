/**
 * Incremental rescoring scope:
 * changed documents → affected findings → affected risks → affected dimensions
 *
 * Never rescores the entire company — only the slices touched by changed evidence.
 */
import type {
  DimensionId,
  Evidence,
  FindingId,
  RiskId,
} from "@/lib/domain";
import type { ExtractedFacts } from "@/lib/domain/evidence";
import { FINDING_POLICY, type RuleId } from "./rules";

/** Fact keys that can fire each rule family. */
export const RULE_FACT_KEYS: Record<RuleId, (keyof ExtractedFacts | string)[]> = {
  "concentration-high": ["top3CustomerArrShare"],
  "concentration-medium": ["top3CustomerArrShare"],
  "ip-gap": ["agreementsMissingIpAssignment", "totalContractorAgreements"],
  "board-approval": [
    "optionGrantsMissingBoardApproval",
    "materialActionsMissingBoardApproval",
  ],
  "runway-high": ["cashRunwayMonths"],
  "runway-medium": ["cashRunwayMonths"],
  "runway-positive": ["cashRunwayMonths"],
  "recurring-revenue": ["recurringRevenueShare"],
  nrr: ["netRevenueRetention"],
  "critical-controls": ["openCriticalControls"],
  mfa: ["mfaCoverage"],
  "low-attrition": ["voluntaryAttritionRate"],
  "key-person": ["singleOwnerCriticalFunctions"],
};

/** Finding → risk id (negative findings only). */
export const FINDING_TO_RISK: Record<string, string> = {
  "finding-concentration": "risk-concentration",
  "finding-ip-gap": "risk-ip-gap",
  "finding-board-approval": "risk-board-approval",
  "finding-runway": "risk-runway",
  "finding-nrr": "risk-nrr",
  "finding-security-readiness": "risk-security",
  "finding-key-person": "risk-key-person",
};

export type AffectedScope = {
  evidenceIds: string[];
  ruleIds: RuleId[];
  findingIds: FindingId[];
  riskIds: RiskId[];
  dimensionIds: DimensionId[];
};

function factKeysPresent(facts: ExtractedFacts): Set<string> {
  return new Set(
    Object.entries(facts)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k]) => k),
  );
}

function rulesForEvidence(evidence: Evidence): RuleId[] {
  const keys = factKeysPresent(evidence.extractedFacts);
  const rules: RuleId[] = [];
  for (const [ruleId, factKeys] of Object.entries(RULE_FACT_KEYS) as Array<
    [RuleId, string[]]
  >) {
    if (factKeys.some((k) => keys.has(k))) {
      rules.push(ruleId);
    }
  }
  return rules;
}

/**
 * Map changed (and optionally prior) evidence into the rescoring scope.
 * Includes prior dimensions when evidence reclassifies.
 */
export function computeAffectedScope(
  changedEvidence: Evidence[],
  priorEvidence: Evidence[] = [],
): AffectedScope {
  const evidenceIds = [
    ...new Set([
      ...changedEvidence.map((e) => e.id),
      ...priorEvidence.map((e) => e.id),
    ]),
  ];

  const ruleIds = new Set<RuleId>();
  const findingIds = new Set<FindingId>();
  const riskIds = new Set<RiskId>();
  const dimensionIds = new Set<DimensionId>();

  const all = [...changedEvidence, ...priorEvidence];
  for (const evidence of all) {
    dimensionIds.add(evidence.dimensionId);
    for (const dim of evidence.dimensionIds) {
      dimensionIds.add(dim);
    }
    for (const ruleId of rulesForEvidence(evidence)) {
      ruleIds.add(ruleId);
      const policy = FINDING_POLICY[ruleId];
      findingIds.add(policy.findingId);
      dimensionIds.add(policy.dimensionId);
      const riskId = FINDING_TO_RISK[policy.findingId];
      if (riskId) riskIds.add(riskId);
    }
  }

  // If we only know evidence IDs (deletes) with no facts, still mark empty scope
  // so callers can prune findings that lost their last evidence.
  return {
    evidenceIds,
    ruleIds: [...ruleIds],
    findingIds: [...findingIds],
    riskIds: [...riskIds],
    dimensionIds: [...dimensionIds],
  };
}

/**
 * Merge engine output with prior state, keeping only affected slices updated.
 * Unchanged findings / risks / dimensions are carried forward.
 */
export function mergeIncrementalIntelligence(input: {
  scope: AffectedScope;
  priorFindings: import("@/lib/domain").Finding[];
  priorRisks: import("@/lib/domain").Risk[];
  priorDimensions: import("@/lib/domain").HealthDimension[];
  nextFindings: import("@/lib/domain").Finding[];
  nextRisks: import("@/lib/domain").Risk[];
  nextDimensions: import("@/lib/domain").HealthDimension[];
}): {
  findings: import("@/lib/domain").Finding[];
  risks: import("@/lib/domain").Risk[];
  dimensions: import("@/lib/domain").HealthDimension[];
  findingsUpsert: import("@/lib/domain").Finding[];
  findingsDelete: FindingId[];
  risksUpsert: import("@/lib/domain").Risk[];
  risksDelete: RiskId[];
  dimensionsChanged: DimensionId[];
} {
  const scopeFinding = new Set(input.scope.findingIds);
  const scopeRisk = new Set(input.scope.riskIds);
  const scopeDim = new Set(input.scope.dimensionIds);

  const nextFindingById = new Map(input.nextFindings.map((f) => [f.id, f]));
  const nextRiskById = new Map(input.nextRisks.map((r) => [r.id, r]));
  const nextDimById = new Map(input.nextDimensions.map((d) => [d.id, d]));

  const findingsUpsert: import("@/lib/domain").Finding[] = [];
  const findingsDelete: FindingId[] = [];
  const risksUpsert: import("@/lib/domain").Risk[] = [];
  const risksDelete: RiskId[] = [];

  // Findings: replace scoped ones from next; drop scoped ones missing in next
  const findings = input.priorFindings.filter((f) => !scopeFinding.has(f.id));
  for (const id of scopeFinding) {
    const next = nextFindingById.get(id);
    if (next) {
      findings.push(next);
      findingsUpsert.push(next);
    } else {
      findingsDelete.push(id);
    }
  }

  const risks = input.priorRisks.filter((r) => !scopeRisk.has(r.id));
  for (const id of scopeRisk) {
    const next = nextRiskById.get(id);
    if (next) {
      risks.push(next);
      risksUpsert.push(next);
    } else {
      risksDelete.push(id);
    }
  }

  // Dimensions: carry forward unscored dims; replace affected
  const dimensions = input.priorDimensions.map((d) => {
    if (!scopeDim.has(d.id)) return d;
    return nextDimById.get(d.id) ?? d;
  });
  // Include any new dimension shells from next that were missing prior
  for (const d of input.nextDimensions) {
    if (scopeDim.has(d.id) && !dimensions.some((x) => x.id === d.id)) {
      dimensions.push(d);
    }
  }

  const dimensionsChanged = [...scopeDim].filter((id) => {
    const prior = input.priorDimensions.find((d) => d.id === id);
    const next = nextDimById.get(id);
    if (!prior && next) return true;
    if (prior && !next) return true;
    if (!prior || !next) return false;
    return prior.score !== next.score || prior.confidence !== next.confidence;
  });

  return {
    findings,
    risks,
    dimensions,
    findingsUpsert,
    findingsDelete,
    risksUpsert,
    risksDelete,
    dimensionsChanged,
  };
}
