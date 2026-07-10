/**
 * Supabase-backed EvidenceRepository — production persistence.
 * Thin adapter over lib/supabase/repository evidence functions.
 */

import type { Evidence } from "@/lib/domain";
import {
  createServiceClient,
  deleteEvidenceByIds,
  listEvidence,
  replaceCompanyEvidence,
  upsertCompanyEvidence,
  type AppSupabaseClient,
} from "@/lib/supabase";
import type { EvidenceRepository } from "./evidence-repository";

export class SupabaseEvidenceRepository implements EvidenceRepository {
  constructor(private readonly client: AppSupabaseClient = createServiceClient()) {}

  async listByCompany(companyId: string): Promise<Evidence[]> {
    return listEvidence(this.client, companyId);
  }

  async getById(
    companyId: string,
    evidenceId: string,
  ): Promise<Evidence | null> {
    const all = await this.listByCompany(companyId);
    return all.find((e) => e.id === evidenceId) ?? null;
  }

  async upsert(companyId: string, evidence: Evidence[]): Promise<void> {
    await upsertCompanyEvidence(this.client, companyId, evidence);
  }

  async replace(companyId: string, evidence: Evidence[]): Promise<void> {
    await replaceCompanyEvidence(this.client, companyId, evidence);
  }

  async deleteByIds(companyId: string, evidenceIds: string[]): Promise<void> {
    await deleteEvidenceByIds(this.client, companyId, evidenceIds);
  }
}
