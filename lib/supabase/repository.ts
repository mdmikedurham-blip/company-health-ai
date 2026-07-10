/**
 * Persistence helpers for Company Health entities in Supabase PostgreSQL.
 *
 * Writes use the service client (server-only). Reads can use either client;
 * browser reads are scoped by RLS to the signed-in user's company.
 */
import type {
  Company,
  Evidence,
  Finding,
  HealthDimension,
  HealthScore,
  Recommendation,
  Risk,
  ScoreChangeExplanation,
  TimelineEvent,
} from "@/lib/domain";
import type { AppSupabaseClient } from "./client";
import type { TablesInsert } from "./database.types";
import {
  companyFromRow,
  companyToInsert,
  evidenceFromRow,
  evidenceToInsert,
  findingFromRow,
  findingToInsert,
  healthScoreFromRow,
  healthScoreToInsert,
  recommendationFromRow,
  recommendationToInsert,
  riskFromRow,
  riskToInsert,
  timelineEventFromRow,
  timelineEventToInsert,
} from "./mappers";

export type PersistEngineResultInput = {
  companyId: string;
  evidence: Evidence[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  healthScore: HealthScore;
  dimensions: HealthDimension[];
  scoreChange?: ScoreChangeExplanation | null;
  timelineEvents: TimelineEvent[];
  asOf?: string;
};

async function assertOk<T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): Promise<NonNullable<T>> {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  if (result.data == null) {
    throw new Error(`${context}: expected data, got null`);
  }
  return result.data as NonNullable<T>;
}

async function assertNoError(
  result: { error: { message: string } | null },
  context: string,
): Promise<void> {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function upsertCompany(
  client: AppSupabaseClient,
  company: Company,
): Promise<Company> {
  const data = await assertOk(
    await client
      .from("companies")
      .upsert(companyToInsert(company), { onConflict: "id" })
      .select()
      .single(),
    "upsertCompany",
  );
  return companyFromRow(data);
}

export async function getCompany(
  client: AppSupabaseClient,
  companyId: string,
): Promise<Company | null> {
  const { data, error } = await client
    .from("companies")
    .select()
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw new Error(`getCompany: ${error.message}`);
  return data ? companyFromRow(data) : null;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function upsertDocuments(
  client: AppSupabaseClient,
  rows: TablesInsert<"documents">[],
): Promise<void> {
  if (rows.length === 0) return;
  await assertNoError(
    await client
      .from("documents")
      .upsert(rows, { onConflict: "company_id,connector_id,external_id" }),
    "upsertDocuments",
  );
}

// ─── Evidence / intelligence entities ────────────────────────────────────────

export async function replaceCompanyEvidence(
  client: AppSupabaseClient,
  companyId: string,
  evidence: Evidence[],
): Promise<void> {
  await assertNoError(
    await client.from("evidence").delete().eq("company_id", companyId),
    "replaceCompanyEvidence.delete",
  );
  if (evidence.length === 0) return;
  await assertNoError(
    await client
      .from("evidence")
      .insert(evidence.map((e) => evidenceToInsert(companyId, e))),
    "replaceCompanyEvidence.insert",
  );
}

export async function listEvidence(
  client: AppSupabaseClient,
  companyId: string,
): Promise<Evidence[]> {
  const data = await assertOk(
    await client
      .from("evidence")
      .select()
      .eq("company_id", companyId)
      .order("collected_at", { ascending: false }),
    "listEvidence",
  );
  return data.map(evidenceFromRow);
}

export async function replaceCompanyFindings(
  client: AppSupabaseClient,
  companyId: string,
  findings: Finding[],
): Promise<void> {
  await assertNoError(
    await client.from("findings").delete().eq("company_id", companyId),
    "replaceCompanyFindings.delete",
  );
  if (findings.length === 0) return;
  await assertNoError(
    await client
      .from("findings")
      .insert(findings.map((f) => findingToInsert(companyId, f))),
    "replaceCompanyFindings.insert",
  );
}

export async function listFindings(
  client: AppSupabaseClient,
  companyId: string,
): Promise<Finding[]> {
  const data = await assertOk(
    await client.from("findings").select().eq("company_id", companyId),
    "listFindings",
  );
  return data.map(findingFromRow);
}

export async function replaceCompanyRisks(
  client: AppSupabaseClient,
  companyId: string,
  risks: Risk[],
): Promise<void> {
  await assertNoError(
    await client.from("risks").delete().eq("company_id", companyId),
    "replaceCompanyRisks.delete",
  );
  if (risks.length === 0) return;
  await assertNoError(
    await client
      .from("risks")
      .insert(risks.map((r) => riskToInsert(companyId, r))),
    "replaceCompanyRisks.insert",
  );
}

export async function listRisks(
  client: AppSupabaseClient,
  companyId: string,
): Promise<Risk[]> {
  const data = await assertOk(
    await client.from("risks").select().eq("company_id", companyId),
    "listRisks",
  );
  return data.map(riskFromRow);
}

export async function replaceCompanyRecommendations(
  client: AppSupabaseClient,
  companyId: string,
  recommendations: Recommendation[],
): Promise<void> {
  await assertNoError(
    await client.from("recommendations").delete().eq("company_id", companyId),
    "replaceCompanyRecommendations.delete",
  );
  if (recommendations.length === 0) return;
  await assertNoError(
    await client
      .from("recommendations")
      .insert(recommendations.map((r) => recommendationToInsert(companyId, r))),
    "replaceCompanyRecommendations.insert",
  );
}

export async function listRecommendations(
  client: AppSupabaseClient,
  companyId: string,
): Promise<Recommendation[]> {
  const data = await assertOk(
    await client
      .from("recommendations")
      .select()
      .eq("company_id", companyId)
      .order("priority_score", { ascending: false }),
    "listRecommendations",
  );
  return data.map(recommendationFromRow);
}

export async function insertHealthScore(
  client: AppSupabaseClient,
  companyId: string,
  healthScore: HealthScore,
  dimensions: HealthDimension[],
  scoreChange?: ScoreChangeExplanation | null,
  asOf?: string,
): Promise<void> {
  await assertNoError(
    await client
      .from("health_scores")
      .insert(
        healthScoreToInsert(
          companyId,
          healthScore,
          dimensions,
          scoreChange,
          asOf,
        ),
      ),
    "insertHealthScore",
  );
}

export async function getLatestHealthScore(
  client: AppSupabaseClient,
  companyId: string,
): Promise<ReturnType<typeof healthScoreFromRow> | null> {
  const { data, error } = await client
    .from("health_scores")
    .select()
    .eq("company_id", companyId)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestHealthScore: ${error.message}`);
  return data ? healthScoreFromRow(data) : null;
}

export async function replaceCompanyTimeline(
  client: AppSupabaseClient,
  companyId: string,
  events: TimelineEvent[],
): Promise<void> {
  await assertNoError(
    await client.from("timeline_events").delete().eq("company_id", companyId),
    "replaceCompanyTimeline.delete",
  );
  if (events.length === 0) return;
  await assertNoError(
    await client
      .from("timeline_events")
      .insert(events.map((e) => timelineEventToInsert(companyId, e))),
    "replaceCompanyTimeline.insert",
  );
}

export async function listTimelineEvents(
  client: AppSupabaseClient,
  companyId: string,
): Promise<TimelineEvent[]> {
  const data = await assertOk(
    await client
      .from("timeline_events")
      .select()
      .eq("company_id", companyId)
      .order("event_date", { ascending: false }),
    "listTimelineEvents",
  );
  return data.map(timelineEventFromRow);
}

// ─── Connector syncs ─────────────────────────────────────────────────────────

export async function startConnectorSync(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    connectorId: string;
    metadata?: TablesInsert<"connector_syncs">["metadata"];
  },
): Promise<string> {
  const data = await assertOk(
    await client
      .from("connector_syncs")
      .insert({
        company_id: input.companyId,
        connector_id: input.connectorId,
        status: "running",
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single(),
    "startConnectorSync",
  );
  return data.id;
}

export async function finishConnectorSync(
  client: AppSupabaseClient,
  syncId: string,
  result: {
    status: "succeeded" | "failed" | "partial";
    documentsAnalyzed?: number;
    evidenceCreated?: number;
    errorMessage?: string | null;
  },
): Promise<void> {
  await assertNoError(
    await client
      .from("connector_syncs")
      .update({
        status: result.status,
        documents_analyzed: result.documentsAnalyzed ?? 0,
        evidence_created: result.evidenceCreated ?? 0,
        error_message: result.errorMessage ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", syncId),
    "finishConnectorSync",
  );
}

/**
 * Persist a full Insight Engine result for a company.
 * Replaces mutable intelligence tables; appends a health_scores row.
 */
export async function persistEngineResult(
  client: AppSupabaseClient,
  input: PersistEngineResultInput,
): Promise<void> {
  const { companyId } = input;

  await replaceCompanyEvidence(client, companyId, input.evidence);
  await replaceCompanyFindings(client, companyId, input.findings);
  await replaceCompanyRisks(client, companyId, input.risks);
  await replaceCompanyRecommendations(
    client,
    companyId,
    input.recommendations,
  );
  await replaceCompanyTimeline(client, companyId, input.timelineEvents);
  await insertHealthScore(
    client,
    companyId,
    input.healthScore,
    input.dimensions,
    input.scoreChange,
    input.asOf,
  );
}
