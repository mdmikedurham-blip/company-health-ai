/**
 * Compatibility shim — Phase 2 intelligence lives in `@/lib/intelligence`.
 * Connectors and legacy imports resolve RawEvidence / runInsightEngine here.
 */
export { runInsightEngine } from "@/lib/intelligence";
export type { InsightEngineInput, InsightEngineOutput } from "@/lib/intelligence";

import type { Evidence } from "@/lib/domain";

/** Evidence before engine enrichment of reverse links. */
export type RawEvidence = Evidence;
