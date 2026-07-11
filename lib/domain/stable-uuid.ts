import { createHash } from "node:crypto";

/**
 * Deterministic UUID (v5-style) from an opaque key.
 * Same key always yields the same UUID — safe for uuid PKs that need stability.
 */
export function deterministicUuid(key: string): string {
  const hash = createHash("sha256").update(`company-health-ai:${key}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function stableFindingUuid(stableKey: string): string {
  return deterministicUuid(`finding:${stableKey}`);
}

export function stableRiskUuid(stableKey: string): string {
  return deterministicUuid(`risk:${stableKey}`);
}

export function stableRecommendationUuid(stableKey: string): string {
  return deterministicUuid(`recommendation:${stableKey}`);
}

export function stableTimelineEventUuid(eventKey: string): string {
  return deterministicUuid(`timeline:${eventKey}`);
}

export function stableTimelineChainUuid(chainKey: string): string {
  return deterministicUuid(`timeline-chain:${chainKey}`);
}
