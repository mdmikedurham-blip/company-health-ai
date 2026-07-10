/**
 * Insight Engine entry that loads Evidence from EvidenceRepository.
 *
 * The engine itself stays pure (Evidence[] in → intelligence out).
 * This orchestration is the production path: repository → runInsightEngine.
 * No mock dashboard arrays.
 */

import type {
  Evidence,
  HealthDimension,
  HealthScore,
} from "@/lib/domain";
import {
  runInsightEngine,
  type InsightEngineInput,
  type InsightEngineOutput,
} from "@/lib/intelligence";
import type { EvidenceRepository } from "@/lib/repositories";
import { createEvidenceRepository } from "@/lib/repositories";

export type RunInsightEngineFromRepositoryInput = Omit<
  InsightEngineInput,
  "evidence"
> & {
  /** Persistence port — defaults to createEvidenceRepository(). */
  repository?: EvidenceRepository;
  /**
   * Optional filter after load (e.g. changed evidence only for diagnostics).
   * Engine still receives the full company set unless replaceEvidence is set.
   */
  evidenceFilter?: (evidence: Evidence[]) => Evidence[];
};

/**
 * Load company evidence from the repository, then run the Insight Engine.
 */
export async function runInsightEngineFromRepository(
  input: RunInsightEngineFromRepositoryInput,
): Promise<InsightEngineOutput & { loadedEvidenceCount: number }> {
  const repository = input.repository ?? createEvidenceRepository();
  let evidence = await repository.listByCompany(input.companyId);

  if (input.evidenceFilter) {
    evidence = input.evidenceFilter(evidence);
  }

  const engine = runInsightEngine({
    companyId: input.companyId,
    evidence,
    previousHealthScore: input.previousHealthScore,
    previous: input.previous,
    documents: input.documents,
    evidenceDocumentIds: input.evidenceDocumentIds,
    dimensionProfiles: input.dimensionProfiles,
    asOf: input.asOf,
  });

  return {
    ...engine,
    loadedEvidenceCount: evidence.length,
  };
}

/**
 * Persist evidence into the repository, then analyze.
 * Used after connector normalize / extraction pipelines.
 */
export async function ingestEvidenceAndAnalyze(input: {
  companyId: string;
  evidence: Evidence[];
  repository?: EvidenceRepository;
  mode?: "upsert" | "replace";
  previousHealthScore?: HealthScore;
  dimensionProfiles?: HealthDimension[];
  asOf?: Date | string;
}): Promise<InsightEngineOutput> {
  const repository = input.repository ?? createEvidenceRepository();
  if (input.mode === "replace") {
    await repository.replace(input.companyId, input.evidence);
  } else {
    await repository.upsert(input.companyId, input.evidence);
  }

  return runInsightEngineFromRepository({
    companyId: input.companyId,
    repository,
    previousHealthScore: input.previousHealthScore,
    dimensionProfiles: input.dimensionProfiles,
    asOf: input.asOf,
  });
}
