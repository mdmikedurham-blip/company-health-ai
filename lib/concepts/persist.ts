/**
 * Persist / load company_business_concepts.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import type {
  BusinessConcept,
  BusinessConceptState,
} from "@/lib/domain/business-concept";
import { isBusinessConceptId } from "./catalog";

type ConceptRow = {
  company_id: string;
  snapshot_id: string | null;
  concept_id: string;
  state: string;
  confidence: number;
  coverage: number;
  supporting_evidence_ids: string[] | null;
  supporting_fact_keys: string[] | null;
  supporting_fact_ids: string[] | null;
  supporting_document_ids: string[] | null;
  contradicting_evidence_ids: string[] | null;
  contradicting_fact_keys: string[] | null;
  reasoning: string;
  fact_values: Record<string, string | number | boolean | string[] | null> | null;
  last_updated: string;
};

function isState(value: string): value is BusinessConceptState {
  return (
    value === "supported" ||
    value === "contradicted" ||
    value === "partial" ||
    value === "unknown" ||
    value === "not_applicable"
  );
}

function rowToConcept(row: ConceptRow): BusinessConcept | null {
  if (!isBusinessConceptId(row.concept_id)) return null;
  return {
    conceptId: row.concept_id,
    companyId: row.company_id,
    label: row.concept_id,
    state: isState(row.state) ? row.state : "unknown",
    confidence: Number(row.confidence) || 0,
    coverage: Number(row.coverage) || 0,
    supportingEvidenceIds: row.supporting_evidence_ids ?? [],
    supportingFactKeys: row.supporting_fact_keys ?? [],
    supportingFactIds: row.supporting_fact_ids ?? [],
    supportingDocumentIds: row.supporting_document_ids ?? [],
    contradictingEvidenceIds: row.contradicting_evidence_ids ?? [],
    contradictingFactKeys: row.contradicting_fact_keys ?? [],
    reasoning: row.reasoning ?? "",
    lastUpdated: row.last_updated,
    snapshotId: row.snapshot_id,
    factValues: row.fact_values ?? {},
  };
}

export async function replaceCompanyBusinessConcepts(input: {
  client: AppSupabaseClient;
  companyId: string;
  concepts: BusinessConcept[];
  snapshotId?: string | null;
}): Promise<void> {
  const { client, companyId, concepts } = input;
  const { error: delError } = await client
    .from("company_business_concepts")
    .delete()
    .eq("company_id", companyId);
  if (delError) {
    if (/does not exist|PGRST|schema cache/i.test(delError.message)) {
      return;
    }
    throw new Error(
      `replaceCompanyBusinessConcepts.delete: ${delError.message}`,
    );
  }

  if (concepts.length === 0) return;

  const rows = concepts.map((c) => ({
    company_id: companyId,
    snapshot_id: input.snapshotId ?? c.snapshotId,
    concept_id: c.conceptId,
    state: c.state,
    confidence: c.confidence,
    coverage: c.coverage,
    supporting_evidence_ids: c.supportingEvidenceIds,
    supporting_fact_keys: c.supportingFactKeys,
    supporting_fact_ids: c.supportingFactIds,
    supporting_document_ids: c.supportingDocumentIds,
    contradicting_evidence_ids: c.contradictingEvidenceIds,
    contradicting_fact_keys: c.contradictingFactKeys,
    reasoning: c.reasoning,
    fact_values: c.factValues,
    last_updated: c.lastUpdated,
  }));

  const { error } = await client.from("company_business_concepts").insert(rows);
  if (error) {
    throw new Error(
      `replaceCompanyBusinessConcepts.insert: ${error.message}`,
    );
  }
}

export async function listCompanyBusinessConcepts(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<BusinessConcept[]> {
  const { data, error } = await input.client
    .from("company_business_concepts")
    .select(
      "company_id, snapshot_id, concept_id, state, confidence, coverage, supporting_evidence_ids, supporting_fact_keys, supporting_fact_ids, supporting_document_ids, contradicting_evidence_ids, contradicting_fact_keys, reasoning, fact_values, last_updated",
    )
    .eq("company_id", input.companyId);

  if (error) {
    if (/does not exist|PGRST|schema cache/i.test(error.message)) {
      return [];
    }
    throw new Error(`listCompanyBusinessConcepts: ${error.message}`);
  }

  return (
    (data as ConceptRow[] | null)
      ?.map(rowToConcept)
      .filter((c): c is BusinessConcept => c != null) ?? []
  );
}
