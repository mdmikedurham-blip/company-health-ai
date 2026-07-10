/**
 * EvidenceRepository — persistence port for normalized Evidence.
 *
 * Intelligence and application layers depend on this interface, not on
 * Supabase or in-memory details. Swap implementations without touching
 * the Insight Engine.
 */

import type { Evidence } from "@/lib/domain";

export interface EvidenceRepository {
  /** List all evidence for a company (newest collectedAt first when possible). */
  listByCompany(companyId: string): Promise<Evidence[]>;

  /** Fetch a single evidence record, or null if missing. */
  getById(companyId: string, evidenceId: string): Promise<Evidence | null>;

  /** Insert or update evidence rows for a company. */
  upsert(companyId: string, evidence: Evidence[]): Promise<void>;

  /** Replace the entire evidence set for a company. */
  replace(companyId: string, evidence: Evidence[]): Promise<void>;

  /** Delete evidence by id. */
  deleteByIds(companyId: string, evidenceIds: string[]): Promise<void>;
}
