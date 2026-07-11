import type { TimelineEvent } from "@/lib/domain";
import {
  stableTimelineChainUuid,
  stableTimelineEventUuid,
} from "@/lib/domain/stable-uuid";
import type { CausalLinkMap } from "./timeline-types";

/**
 * Human-readable event key (text only — never a uuid column value).
 */
export function timelineEventKey(
  type: string,
  entityId: string,
  suffix?: string,
): string {
  const base = `tl-${type}-${entityId}`;
  return suffix ? `${base}-${suffix}` : base;
}

/**
 * Deterministic UUID for timeline_events.id from the stable event key.
 */
export function stableEventId(
  type: string,
  entityId: string,
  suffix?: string,
): string {
  return stableTimelineEventUuid(timelineEventKey(type, entityId, suffix));
}

export function stableChainId(rootEventId: string): string {
  // rootEventId is already a timeline event UUID; derive a chain UUID from it.
  return stableTimelineChainUuid(`chain:${rootEventId}`);
}

export function resolveCausalLinks(params: {
  parentEventId?: string;
  fallbackParentIds?: string[];
  links: CausalLinkMap;
}): {
  parentEventId?: string;
  rootEventId: string;
  causalChainId: string;
} {
  const parentEventId =
    params.parentEventId ??
    [...(params.fallbackParentIds ?? [])].sort()[0];

  if (!parentEventId) {
    return {
      parentEventId: undefined,
      rootEventId: "",
      causalChainId: "",
    };
  }

  return {
    parentEventId,
    rootEventId: parentEventId,
    causalChainId: stableChainId(parentEventId),
  };
}

export function applySelfRoot(
  eventId: string,
  links: { parentEventId?: string; rootEventId: string; causalChainId: string },
): { parentEventId?: string; rootEventId: string; causalChainId: string } {
  if (links.rootEventId) return links;
  return {
    parentEventId: links.parentEventId,
    rootEventId: eventId,
    causalChainId: stableChainId(eventId),
  };
}

export function inheritRootFromParent(
  parent: TimelineEvent | undefined,
  parentEventId: string | undefined,
  selfId: string,
): { parentEventId?: string; rootEventId: string; causalChainId: string } {
  if (parent) {
    return {
      parentEventId: parent.id,
      rootEventId: parent.rootEventId || parent.id,
      causalChainId:
        parent.causalChainId ||
        stableChainId(parent.rootEventId || parent.id),
    };
  }
  if (parentEventId) {
    return {
      parentEventId,
      rootEventId: parentEventId,
      causalChainId: stableChainId(parentEventId),
    };
  }
  return {
    parentEventId: undefined,
    rootEventId: selfId,
    causalChainId: stableChainId(selfId),
  };
}

export function createLinkMap(): CausalLinkMap {
  return {
    byKey: new Map(),
    evidenceEventById: new Map(),
    findingEventById: new Map(),
    riskEventById: new Map(),
    dimensionEventById: new Map(),
    documentEventById: new Map(),
  };
}

export function pickParentForEvidence(params: {
  evidenceId: string;
  sourceDocumentId?: string;
  links: CausalLinkMap;
}): string | undefined {
  if (params.sourceDocumentId) {
    return params.links.documentEventById.get(params.sourceDocumentId);
  }
  return undefined;
}

export function pickParentForFinding(params: {
  evidenceIds: string[];
  links: CausalLinkMap;
}): string | undefined {
  const parents = params.evidenceIds
    .map((id) => params.links.evidenceEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  return parents[0];
}

export function pickParentForRisk(params: {
  findingIds: string[];
  evidenceIds: string[];
  links: CausalLinkMap;
}): string | undefined {
  const fromFindings = params.findingIds
    .map((id) => params.links.findingEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  if (fromFindings[0]) return fromFindings[0];
  const fromEvidence = params.evidenceIds
    .map((id) => params.links.evidenceEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  return fromEvidence[0];
}

export function pickParentForDimension(params: {
  findingIds: string[];
  links: CausalLinkMap;
}): string | undefined {
  const parents = params.findingIds
    .map((id) => params.links.findingEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  return parents[0];
}

export function pickParentForOverall(params: {
  dimensionIds: string[];
  findingIds: string[];
  riskIds: string[];
  links: CausalLinkMap;
}): string | undefined {
  const fromDims = params.dimensionIds
    .map((id) => params.links.dimensionEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  if (fromDims[0]) return fromDims[0];
  const fromFindings = params.findingIds
    .map((id) => params.links.findingEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  if (fromFindings[0]) return fromFindings[0];
  const fromRisks = params.riskIds
    .map((id) => params.links.riskEventById.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
  return fromRisks[0];
}
