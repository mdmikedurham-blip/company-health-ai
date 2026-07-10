/**
 * In-memory EvidenceRepository — default for local/dev and tests.
 * Production swaps to SupabaseEvidenceRepository when configured.
 */

import type { Evidence } from "@/lib/domain";
import type { EvidenceRepository } from "./evidence-repository";

function cloneEvidence(evidence: Evidence): Evidence {
  return {
    ...evidence,
    extractedFacts: { ...evidence.extractedFacts },
    dimensionIds: [...evidence.dimensionIds],
    findingIds: [...evidence.findingIds],
    linkedRiskIds: [...evidence.linkedRiskIds],
    metadata: { ...evidence.metadata },
    citation: { ...evidence.citation },
  };
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly byCompany = new Map<string, Map<string, Evidence>>();

  private companyMap(companyId: string): Map<string, Evidence> {
    let map = this.byCompany.get(companyId);
    if (!map) {
      map = new Map();
      this.byCompany.set(companyId, map);
    }
    return map;
  }

  async listByCompany(companyId: string): Promise<Evidence[]> {
    const rows = [...this.companyMap(companyId).values()].map(cloneEvidence);
    rows.sort((a, b) => (a.collectedAt < b.collectedAt ? 1 : -1));
    return rows;
  }

  async getById(
    companyId: string,
    evidenceId: string,
  ): Promise<Evidence | null> {
    const row = this.companyMap(companyId).get(evidenceId);
    return row ? cloneEvidence(row) : null;
  }

  async upsert(companyId: string, evidence: Evidence[]): Promise<void> {
    const map = this.companyMap(companyId);
    for (const item of evidence) {
      map.set(item.id, cloneEvidence(item));
    }
  }

  async replace(companyId: string, evidence: Evidence[]): Promise<void> {
    const map = new Map<string, Evidence>();
    for (const item of evidence) {
      map.set(item.id, cloneEvidence(item));
    }
    this.byCompany.set(companyId, map);
  }

  async deleteByIds(companyId: string, evidenceIds: string[]): Promise<void> {
    const map = this.companyMap(companyId);
    for (const id of evidenceIds) {
      map.delete(id);
    }
  }

  /** Test helper — wipe all companies. */
  clear(): void {
    this.byCompany.clear();
  }
}

/** Process-wide default in-memory store (seedable for demos/tests). */
let sharedInMemory: InMemoryEvidenceRepository | null = null;

export function getSharedInMemoryEvidenceRepository(): InMemoryEvidenceRepository {
  if (!sharedInMemory) {
    sharedInMemory = new InMemoryEvidenceRepository();
  }
  return sharedInMemory;
}

/** Reset the shared store (tests). */
export function resetSharedInMemoryEvidenceRepository(): void {
  sharedInMemory?.clear();
  sharedInMemory = null;
}
