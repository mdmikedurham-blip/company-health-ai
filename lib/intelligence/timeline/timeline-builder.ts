import type {
  CompanyId,
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  TimelineEvent,
} from "@/lib/domain";
import { DIMENSION_NAMES } from "@/lib/intelligence/rules";
import {
  createLinkMap,
  inheritRootFromParent,
  pickParentForDimension,
  pickParentForEvidence,
  pickParentForFinding,
  pickParentForOverall,
  pickParentForRisk,
  stableEventId,
  timelineEventKey,
} from "./causal-linker";
import { diffAnalysis } from "./event-diff";
import type {
  TimelineDocument,
  TimelinePreviousSlice,
} from "./timeline-types";

/** Local asOf resolver — avoid circular import with insight-engine. */
const DEFAULT_AS_OF = "2026-07-09T13:42:00.000Z";

function resolveAsOf(asOf?: Date | string): Date {
  if (asOf instanceof Date) return asOf;
  if (typeof asOf === "string") return new Date(asOf);
  return new Date(DEFAULT_AS_OF);
}

function withEventKey(
  type: string,
  entityId: string,
  extra: Record<string, string | number | boolean | null> = {},
): Record<string, string | number | boolean | null> {
  return { eventKey: timelineEventKey(type, entityId), ...extra };
}

export interface BuildCausalTimelineInput {
  companyId: CompanyId;
  findings: Finding[];
  risks: Risk[];
  evidence: Evidence[];
  dimensions: HealthDimension[];
  healthScore: HealthScore;
  recommendations: Recommendation[];
  previous?: TimelinePreviousSlice;
  documents?: TimelineDocument[];
  /** ISO or Date — deterministic stamps. */
  asOf?: Date | string;
  /**
   * Optional map evidenceId → source document id for provenance.
   * When absent, document id is inferred from evidence metadata.documentId.
   */
  evidenceDocumentIds?: Record<string, string>;
}

/**
 * Build a linked causal timeline from current vs prior analysis.
 * Deterministic: same inputs ⇒ same events and IDs.
 *
 * Chain: Document → Evidence → Finding → Risk → Dimension Score → Overall Score
 */
export function buildCausalTimeline(
  input: BuildCausalTimelineInput,
): TimelineEvent[] {
  const asOf = resolveAsOf(input.asOf);
  const occurredAt = asOf.toISOString();
  const date = formatTimelineDate(asOf);
  const month = formatTimelineMonth(asOf);
  const links = createLinkMap();
  const eventsById = new Map<string, TimelineEvent>();
  const events: TimelineEvent[] = [];

  const diff = diffAnalysis({
    previous: input.previous,
    findings: input.findings,
    risks: input.risks,
    evidence: input.evidence,
    dimensions: input.dimensions,
    healthScore: input.healthScore,
    recommendations: input.recommendations,
    documents: input.documents,
  });

  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]));
  const findingById = new Map(input.findings.map((f) => [f.id, f]));
  const riskById = new Map(input.risks.map((r) => [r.id, r]));
  const priorRiskById = new Map(
    (input.previous?.risks ?? []).map((r) => [r.id, r]),
  );
  const priorFindingById = new Map(
    (input.previous?.findings ?? []).map((f) => [f.id, f]),
  );
  const recommendationById = new Map(
    input.recommendations.map((r) => [r.id, r]),
  );

  function resolveDocId(evidenceId: string): string | undefined {
    if (input.evidenceDocumentIds?.[evidenceId]) {
      return input.evidenceDocumentIds[evidenceId];
    }
    const ev = evidenceById.get(evidenceId);
    const meta = ev?.metadata?.documentId;
    return typeof meta === "string" ? meta : undefined;
  }

  function push(event: TimelineEvent): void {
    if (eventsById.has(event.id)) return; // duplicate prevention
    eventsById.set(event.id, event);
    events.push(event);
  }

  function getParent(id: string | undefined): TimelineEvent | undefined {
    return id ? eventsById.get(id) : undefined;
  }

  // ── 1. Document events ───────────────────────────────────────────────────
  for (const doc of diff.documents.added) {
    const id = stableEventId("document-added", doc.id);
    const causal = inheritRootFromParent(undefined, undefined, id);
    push(
      makeEvent({
        id,
        companyId: input.companyId,
        type: "document-added",
        title: doc.title,
        summary: `Document added${doc.connectorId ? ` via ${doc.connectorId}` : ""}.`,
        occurredAt,
        date,
        month,
        sourceDocumentId: doc.id,
        evidenceIds: [],
        findingIds: [],
        riskIds: [],
        confidence: 100,
        ...causal,
        metadata: withEventKey("document-added", doc.id, {
          externalId: doc.externalId ?? null,
          contentHash: doc.contentHash ?? null,
        }),
      }),
    );
    links.documentEventById.set(doc.id, id);
  }

  for (const doc of diff.documents.updated) {
    const id = stableEventId("document-updated", doc.id);
    const causal = inheritRootFromParent(undefined, undefined, id);
    push(
      makeEvent({
        id,
        companyId: input.companyId,
        type: "document-updated",
        title: doc.title,
        summary: `Document updated${doc.connectorId ? ` via ${doc.connectorId}` : ""}.`,
        occurredAt,
        date,
        month,
        sourceDocumentId: doc.id,
        evidenceIds: [],
        findingIds: [],
        riskIds: [],
        confidence: 100,
        ...causal,
        metadata: withEventKey("document-updated", doc.id, {
          externalId: doc.externalId ?? null,
          contentHash: doc.contentHash ?? null,
        }),
      }),
    );
    links.documentEventById.set(doc.id, id);
  }

  // ── 2. Evidence created ──────────────────────────────────────────────────
  for (const evidenceId of diff.evidenceCreated) {
    const item = evidenceById.get(evidenceId);
    if (!item) continue;
    const sourceDocumentId = resolveDocId(evidenceId);
    const parentEventId = pickParentForEvidence({
      evidenceId,
      sourceDocumentId,
      links,
    });
    const id = stableEventId("evidence-created", evidenceId);
    const causal = inheritRootFromParent(
      getParent(parentEventId),
      parentEventId,
      id,
    );
    const incomplete = !sourceDocumentId;
    push(
      makeEvent({
        id,
        companyId: input.companyId,
        type: "evidence-created",
        title: item.title,
        summary: incomplete
          ? `${item.contentSummary} Provenance incomplete: no source document linked.`
          : item.contentSummary,
        occurredAt: toIsoOrFallback(item.collectedAt, occurredAt),
        date: item.collectedAt || date,
        month,
        sourceDocumentId,
        evidenceIds: [evidenceId],
        findingIds: [],
        riskIds: [],
        dimensionId: item.dimensionId,
        dimension: item.dimension,
        confidence: item.reliability,
        ...causal,
        metadata: withEventKey(
          "evidence-created",
          evidenceId,
          incomplete ? { incompleteProvenance: true } : {},
        ),
      }),
    );
    links.evidenceEventById.set(evidenceId, id);
  }

  // ── 3. Findings created / updated ────────────────────────────────────────
  for (const findingId of diff.findings.created) {
    const finding = findingById.get(findingId);
    if (!finding) continue;
    pushFindingEvent({
      finding,
      type: "finding-created",
      prior: undefined,
      occurredAt,
      date,
      month,
      companyId: input.companyId,
      links,
      eventsById,
      push,
      resolveDocId,
    });
  }

  for (const findingId of diff.findings.updated) {
    const finding = findingById.get(findingId);
    if (!finding) continue;
    pushFindingEvent({
      finding,
      type: "finding-updated",
      prior: priorFindingById.get(findingId),
      occurredAt,
      date,
      month,
      companyId: input.companyId,
      links,
      eventsById,
      push,
      resolveDocId,
    });
  }

  // ── 4. Risks created / updated / resolved ────────────────────────────────
  for (const riskId of diff.risks.created) {
    const risk = riskById.get(riskId);
    if (!risk) continue;
    pushRiskEvent({
      risk,
      type: "risk-created",
      prior: undefined,
      occurredAt,
      date,
      month,
      companyId: input.companyId,
      links,
      eventsById,
      push,
      resolveDocId,
    });
  }

  for (const riskId of diff.risks.updated) {
    const risk = riskById.get(riskId);
    if (!risk) continue;
    pushRiskEvent({
      risk,
      type: "risk-updated",
      prior: priorRiskById.get(riskId),
      occurredAt,
      date,
      month,
      companyId: input.companyId,
      links,
      eventsById,
      push,
      resolveDocId,
    });
  }

  for (const riskId of diff.risks.resolved) {
    const risk =
      riskById.get(riskId) ??
      (priorRiskById.get(riskId)
        ? syntheticResolvedRisk(priorRiskById.get(riskId)!)
        : undefined);
    if (!risk) continue;
    pushRiskEvent({
      risk,
      type: "risk-resolved",
      prior: priorRiskById.get(riskId),
      occurredAt,
      date,
      month,
      companyId: input.companyId,
      links,
      eventsById,
      push,
      resolveDocId,
    });
  }

  // ── 5. Dimension score changes (must link to findings) ───────────────────
  for (const dim of diff.dimensions) {
    if (dim.findingIds.length === 0 && dim.evidenceIds.length === 0) {
      // Never emit unlinked score movement
      continue;
    }
    const parentEventId = pickParentForDimension({
      findingIds: dim.findingIds,
      links,
    });
    // Require a causal parent when findings exist in this run
    if (!parentEventId && dim.findingIds.length > 0) {
      // Findings may be unchanged (not in this timeline) — still allow if evidence present
      const evidenceParent = pickParentForFinding({
        evidenceIds: dim.evidenceIds,
        links,
      });
      if (!evidenceParent && !input.previous) {
        // first run without finding events somehow — skip
      }
    }
    const linkedFindingIds = dim.findingIds.filter((id) =>
      links.findingEventById.has(id),
    );
    if (linkedFindingIds.length === 0 && dim.findingIds.length > 0) {
      // Findings didn't change this period but drove score via explanations —
      // still require at least evidence linkage for provenance
      if (dim.evidenceIds.length === 0) continue;
    }

    const id = stableEventId("dimension-score-changed", dim.dimensionId);
    const parent =
      parentEventId ??
      pickParentForFinding({ evidenceIds: dim.evidenceIds, links });
    if (!parent && linkedFindingIds.length === 0 && dim.evidenceIds.every((e) => !links.evidenceEventById.has(e))) {
      continue;
    }
    const causal = inheritRootFromParent(getParent(parent), parent, id);
    const sourceDocumentId = firstDocId(dim.evidenceIds, resolveDocId);
    push(
      makeEvent({
        id,
        companyId: input.companyId,
        type: "dimension-score-changed",
        title: `${dim.dimension} score ${formatSigned(dim.change)}`,
        summary: `${dim.dimension} moved from ${dim.previousScore} to ${dim.currentScore}.`,
        occurredAt,
        date,
        month,
        sourceDocumentId,
        evidenceIds: dim.evidenceIds,
        findingIds: dim.findingIds,
        riskIds: [],
        dimensionId: dim.dimensionId,
        dimension: dim.dimension,
        previousValue: dim.previousScore,
        currentValue: dim.currentScore,
        scoreDelta: dim.change,
        scoreBefore: dim.previousScore,
        scoreAfter: dim.currentScore,
        confidence: input.healthScore.confidence,
        ...causal,
        metadata: withEventKey("dimension-score-changed", dim.dimensionId),
      }),
    );
    links.dimensionEventById.set(dim.dimensionId, id);
  }

  // ── 6. Overall score change (must link to findings/risks/dimensions) ─────
  if (diff.overallScore && diff.overallScore.change !== 0) {
    const causingFindingIds = [
      ...diff.findings.created,
      ...diff.findings.updated,
    ];
    const causingRiskIds = [
      ...diff.risks.created,
      ...diff.risks.updated,
      ...diff.risks.resolved,
    ];
    const causingDimIds = diff.dimensions.map((d) => d.dimensionId);

    const parentEventId = pickParentForOverall({
      dimensionIds: causingDimIds,
      findingIds: causingFindingIds,
      riskIds: causingRiskIds,
      links,
    });

    // Never create score-change without causal link
    if (parentEventId) {
      const id = stableEventId("overall-score-changed", "health");
      const causal = inheritRootFromParent(
        getParent(parentEventId),
        parentEventId,
        id,
      );
      const allEvidence = sortedUnique(
        [
          ...causingFindingIds.flatMap(
            (fid) => findingById.get(fid)?.evidenceIds ?? [],
          ),
          ...causingRiskIds.flatMap(
            (rid) => riskById.get(rid)?.evidenceIds ?? [],
          ),
        ],
      );
      push(
        makeEvent({
          id,
          companyId: input.companyId,
          type: "overall-score-changed",
          title: `Health score ${diff.overallScore.currentScore}`,
          summary: `Overall health ${formatSigned(diff.overallScore.change)} (was ${diff.overallScore.previousScore}).`,
          occurredAt,
          date,
          month,
          sourceDocumentId: firstDocId(allEvidence, resolveDocId),
          evidenceIds: allEvidence,
          findingIds: causingFindingIds.sort(),
          riskIds: causingRiskIds.sort(),
          previousValue: diff.overallScore.previousScore,
          currentValue: diff.overallScore.currentScore,
          scoreDelta: diff.overallScore.change,
          scoreBefore: diff.overallScore.previousScore,
          scoreAfter: diff.overallScore.currentScore,
          whyHealthChanged: causingFindingIds
            .map((fid) => {
              const f = findingById.get(fid);
              return f ? `${f.dimension}: ${formatSigned(f.scoreImpact)}` : null;
            })
            .filter(Boolean)
            .join("; "),
          confidence: input.healthScore.confidence,
          ...causal,
          metadata: withEventKey("overall-score-changed", "health"),
        }),
      );
    }
  }

  // ── 7. Recommendations created ───────────────────────────────────────────
  for (const recId of diff.recommendationsCreated) {
    const rec = recommendationById.get(recId);
    if (!rec) continue;
    const parentEventId = pickParentForRisk({
      findingIds: rec.findingIds,
      evidenceIds: rec.evidenceIds,
      links,
    });
    const id = stableEventId("recommendation-created", recId);
    const causal = inheritRootFromParent(
      getParent(parentEventId),
      parentEventId,
      id,
    );
    push(
      makeEvent({
        id,
        companyId: input.companyId,
        type: "recommendation-created",
        title: rec.title,
        summary: rec.description,
        occurredAt,
        date,
        month,
        sourceDocumentId: firstDocId(rec.evidenceIds, resolveDocId),
        evidenceIds: [...rec.evidenceIds].sort(),
        findingIds: [...rec.findingIds].sort(),
        riskIds: [...rec.riskIds].sort(),
        dimensionId: rec.dimensionId,
        dimension: rec.dimension,
        confidence: rec.confidence,
        ...causal,
        metadata: withEventKey("recommendation-created", recId, {
          priority: rec.priority,
        }),
      }),
    );
  }

  // Stable order: by occurredAt, then id
  return events.sort((a, b) => {
    const t = a.occurredAt.localeCompare(b.occurredAt);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function pushFindingEvent(params: {
  finding: Finding;
  type: "finding-created" | "finding-updated";
  prior?: TimelinePreviousSlice["findings"][number];
  occurredAt: string;
  date: string;
  month: string;
  companyId: string;
  links: ReturnType<typeof createLinkMap>;
  eventsById: Map<string, TimelineEvent>;
  push: (e: TimelineEvent) => void;
  resolveDocId: (id: string) => string | undefined;
}): void {
  const { finding, type } = params;
  const parentEventId = pickParentForFinding({
    evidenceIds: finding.evidenceIds,
    links: params.links,
  });
  const id = stableEventId(type, finding.id);
  const parent = parentEventId
    ? params.eventsById.get(parentEventId)
    : undefined;
  const causal = inheritRootFromParent(parent, parentEventId, id);
  const incomplete = finding.evidenceIds.length === 0;
  params.push(
    makeEvent({
      id,
      companyId: params.companyId,
      type,
      title: finding.title,
      summary: incomplete
        ? `${finding.description} Provenance incomplete: no evidence linked.`
        : finding.description,
      occurredAt: toIsoOrFallback(finding.extractedAt, params.occurredAt),
      date: finding.extractedAt || params.date,
      month: params.month,
      sourceDocumentId: firstDocId(finding.evidenceIds, params.resolveDocId),
      evidenceIds: [...finding.evidenceIds].sort(),
      findingIds: [finding.id],
      riskIds: [],
      dimensionId: finding.dimensionId,
      dimension: finding.dimension,
      previousValue: params.prior?.scoreImpact,
      currentValue: finding.scoreImpact,
      scoreDelta:
        params.prior !== undefined
          ? finding.scoreImpact - params.prior.scoreImpact
          : finding.scoreImpact,
      confidence: finding.confidence,
      ...causal,
      metadata: withEventKey(
        type,
        finding.id,
        incomplete ? { incompleteProvenance: true } : {},
      ),
    }),
  );
  params.links.findingEventById.set(finding.id, id);
}

function pushRiskEvent(params: {
  risk: Risk;
  type: "risk-created" | "risk-updated" | "risk-resolved";
  prior?: TimelinePreviousSlice["risks"][number];
  occurredAt: string;
  date: string;
  month: string;
  companyId: string;
  links: ReturnType<typeof createLinkMap>;
  eventsById: Map<string, TimelineEvent>;
  push: (e: TimelineEvent) => void;
  resolveDocId: (id: string) => string | undefined;
}): void {
  const { risk, type } = params;
  const parentEventId = pickParentForRisk({
    findingIds: risk.findingIds,
    evidenceIds: risk.evidenceIds,
    links: params.links,
  });
  const id = stableEventId(type, risk.id);
  const parent = parentEventId
    ? params.eventsById.get(parentEventId)
    : undefined;
  const causal = inheritRootFromParent(parent, parentEventId, id);
  const incomplete = risk.evidenceIds.length === 0;
  const summary =
    type === "risk-updated" && params.prior
      ? `Severity ${params.prior.severity} → ${risk.severity}. ${risk.summary}`
      : type === "risk-resolved"
        ? `Risk resolved. ${risk.summary}`
        : risk.summary;

  params.push(
    makeEvent({
      id,
      companyId: params.companyId,
      type,
      title: risk.title,
      summary: incomplete
        ? `${summary} Provenance incomplete: no evidence linked.`
        : summary,
      occurredAt: params.occurredAt,
      date: params.date,
      month: params.month,
      sourceDocumentId: firstDocId(risk.evidenceIds, params.resolveDocId),
      evidenceIds: [...risk.evidenceIds].sort(),
      findingIds: [...risk.findingIds].sort(),
      riskIds: [risk.id],
      dimensionId: risk.dimensionId,
      dimension: risk.dimension,
      previousValue: params.prior?.estimatedScoreImpact,
      currentValue: risk.estimatedScoreImpact,
      scoreDelta:
        params.prior !== undefined
          ? risk.estimatedScoreImpact - params.prior.estimatedScoreImpact
          : risk.estimatedScoreImpact,
      confidence: risk.confidence,
      whyHealthChanged: risk.whyItMatters,
      ...causal,
      metadata: withEventKey(type, risk.id, {
        severity: risk.severity,
        priorSeverity: params.prior?.severity ?? null,
        status: risk.status,
        ...(incomplete ? { incompleteProvenance: true } : {}),
      }),
    }),
  );
  params.links.riskEventById.set(risk.id, id);
}

function syntheticResolvedRisk(
  prior: TimelinePreviousSlice["risks"][number],
): Risk {
  return {
    id: prior.id,
    title: prior.title,
    summary: prior.summary,
    dimensionId: prior.dimensionId,
    dimension: DIMENSION_NAMES[prior.dimensionId] ?? prior.dimensionId,
    severity: prior.severity as Risk["severity"],
    likelihood: 0,
    impact: 0,
    findingIds: prior.findingIds,
    evidenceIds: prior.evidenceIds,
    confidence: prior.confidence,
    status: "resolved",
    estimatedScoreImpact: prior.estimatedScoreImpact,
    whyItMatters: prior.summary,
    recommendationId: "",
    recommendation: "",
    primaryEvidenceLabel: "",
    explainPrompt: "",
  };
}

function makeEvent(
  partial: Omit<TimelineEvent, "description"> & { summary: string },
): TimelineEvent {
  const {
    summary,
    evidenceIds = [],
    findingIds = [],
    riskIds = [],
    confidence = 0,
    metadata = {},
    rootEventId,
    causalChainId,
    companyId,
    occurredAt,
    ...rest
  } = partial;

  return {
    ...rest,
    companyId,
    occurredAt,
    summary,
    description: summary,
    evidenceIds,
    findingIds,
    riskIds,
    confidence,
    metadata,
    rootEventId: rootEventId || rest.id,
    causalChainId: causalChainId || `chain-${rest.id}`,
    scoreBefore: rest.scoreBefore ?? (typeof rest.previousValue === "number" ? rest.previousValue : undefined),
    scoreAfter: rest.scoreAfter ?? (typeof rest.currentValue === "number" ? rest.currentValue : undefined),
  };
}

function firstDocId(
  evidenceIds: string[],
  resolveDocId: (id: string) => string | undefined,
): string | undefined {
  for (const id of [...evidenceIds].sort()) {
    const doc = resolveDocId(id);
    if (doc) return doc;
  }
  return undefined;
}

function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatTimelineDate(asOf: Date): string {
  return asOf.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimelineMonth(asOf: Date): string {
  return asOf.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toIsoOrFallback(value: string, fallback: string): string {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return fallback;
}

export type { TimelineDocument, TimelinePreviousSlice };
