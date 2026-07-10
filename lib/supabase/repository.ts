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
import type { Tables, TablesInsert, TablesUpdate } from "./database.types";
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

export type StoredDocumentRow = {
  id: string;
  externalId: string;
  contentHash: string | null;
  modifiedAt: string | null;
};

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

export async function listDocuments(
  client: AppSupabaseClient,
  companyId: string,
  connectorId?: string,
): Promise<StoredDocumentRow[]> {
  let query = client
    .from("documents")
    .select("id, external_id, content_hash, modified_at")
    .eq("company_id", companyId);
  if (connectorId) {
    query = query.eq("connector_id", connectorId);
  }
  const data = await assertOk(await query, "listDocuments");
  return data.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    contentHash: row.content_hash,
    modifiedAt: row.modified_at,
  }));
}

export async function deleteDocumentsByExternalIds(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
  externalIds: string[],
): Promise<void> {
  if (externalIds.length === 0) return;
  await assertNoError(
    await client
      .from("documents")
      .delete()
      .eq("company_id", companyId)
      .eq("connector_id", connectorId)
      .in("external_id", externalIds),
    "deleteDocumentsByExternalIds",
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

/** Incremental Evidence Store write — upsert by stable evidence id. */
export async function upsertCompanyEvidence(
  client: AppSupabaseClient,
  companyId: string,
  evidence: Evidence[],
): Promise<void> {
  if (evidence.length === 0) return;
  await assertNoError(
    await client.from("evidence").upsert(
      evidence.map((e) => evidenceToInsert(companyId, e)),
      { onConflict: "id" },
    ),
    "upsertCompanyEvidence",
  );
}

export async function deleteEvidenceByIds(
  client: AppSupabaseClient,
  companyId: string,
  evidenceIds: string[],
): Promise<void> {
  if (evidenceIds.length === 0) return;
  await assertNoError(
    await client
      .from("evidence")
      .delete()
      .eq("company_id", companyId)
      .in("id", evidenceIds),
    "deleteEvidenceByIds",
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

export async function upsertCompanyFindings(
  client: AppSupabaseClient,
  companyId: string,
  findings: Finding[],
): Promise<void> {
  if (findings.length === 0) return;
  await assertNoError(
    await client.from("findings").upsert(
      findings.map((f) => findingToInsert(companyId, f)),
      { onConflict: "id" },
    ),
    "upsertCompanyFindings",
  );
}

export async function deleteFindingsByIds(
  client: AppSupabaseClient,
  companyId: string,
  findingIds: string[],
): Promise<void> {
  if (findingIds.length === 0) return;
  await assertNoError(
    await client
      .from("findings")
      .delete()
      .eq("company_id", companyId)
      .in("id", findingIds),
    "deleteFindingsByIds",
  );
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

export async function upsertCompanyRisks(
  client: AppSupabaseClient,
  companyId: string,
  risks: Risk[],
): Promise<void> {
  if (risks.length === 0) return;
  await assertNoError(
    await client.from("risks").upsert(
      risks.map((r) => riskToInsert(companyId, r)),
      { onConflict: "id" },
    ),
    "upsertCompanyRisks",
  );
}

export async function deleteRisksByIds(
  client: AppSupabaseClient,
  companyId: string,
  riskIds: string[],
): Promise<void> {
  if (riskIds.length === 0) return;
  await assertNoError(
    await client
      .from("risks")
      .delete()
      .eq("company_id", companyId)
      .in("id", riskIds),
    "deleteRisksByIds",
  );
}

/**
 * Persist only affected findings/risks and append a health score when dimensions changed.
 * Never wipe-and-replace the entire company intelligence set.
 */
export async function persistIncrementalEngineResult(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    findingsUpsert: Finding[];
    findingsDelete: string[];
    risksUpsert: Risk[];
    risksDelete: string[];
    evidence: Evidence[];
    healthScore: HealthScore;
    dimensions: HealthDimension[];
    scoreChange?: ScoreChangeExplanation | null;
    asOf?: string;
  },
): Promise<void> {
  await deleteFindingsByIds(client, input.companyId, input.findingsDelete);
  await upsertCompanyFindings(client, input.companyId, input.findingsUpsert);
  await deleteRisksByIds(client, input.companyId, input.risksDelete);
  await upsertCompanyRisks(client, input.companyId, input.risksUpsert);
  // Refresh reverse links on evidence that was touched
  await upsertCompanyEvidence(client, input.companyId, input.evidence);
  await insertHealthScore(
    client,
    input.companyId,
    input.healthScore,
    input.dimensions,
    input.scoreChange,
    input.asOf,
  );
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
    metadata?: TablesInsert<"connector_syncs">["metadata"];
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
        ...(result.metadata !== undefined
          ? { metadata: result.metadata }
          : {}),
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

// ─── Connector credentials ───────────────────────────────────────────────────

export type ConnectorCredentialRow = Tables<"connector_credentials">;

/** Public connection status — never includes encrypted_refresh_token. */
export type ConnectorConnectionStatus = {
  companyId: string;
  connectorId: string;
  status: ConnectorCredentialRow["status"];
  accountEmail: string | null;
  scopes: string[];
  lastSyncedAt: string | null;
  accessTokenExpiresAt: string | null;
};

export async function getConnectorCredential(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
): Promise<ConnectorCredentialRow | null> {
  const { data, error } = await client
    .from("connector_credentials")
    .select()
    .eq("company_id", companyId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw new Error(`getConnectorCredential: ${error.message}`);
  return data;
}

export async function upsertConnectorCredential(
  client: AppSupabaseClient,
  row: TablesInsert<"connector_credentials">,
): Promise<ConnectorCredentialRow> {
  const data = await assertOk(
    await client
      .from("connector_credentials")
      .upsert(row, { onConflict: "company_id,connector_id" })
      .select()
      .single(),
    "upsertConnectorCredential",
  );
  return data;
}

export async function updateConnectorCredential(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
  patch: TablesUpdate<"connector_credentials">,
): Promise<void> {
  await assertNoError(
    await client
      .from("connector_credentials")
      .update(patch)
      .eq("company_id", companyId)
      .eq("connector_id", connectorId),
    "updateConnectorCredential",
  );
}

export async function deleteConnectorCredential(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
): Promise<void> {
  await assertNoError(
    await client
      .from("connector_credentials")
      .delete()
      .eq("company_id", companyId)
      .eq("connector_id", connectorId),
    "deleteConnectorCredential",
  );
}

export async function listConnectedCompaniesForConnector(
  client: AppSupabaseClient,
  connectorId: string,
): Promise<string[]> {
  const data = await assertOk(
    await client
      .from("connector_credentials")
      .select("company_id")
      .eq("connector_id", connectorId)
      .eq("status", "connected"),
    "listConnectedCompaniesForConnector",
  );
  return data.map((row) => row.company_id);
}

export async function getConnectorConnectionStatus(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
): Promise<ConnectorConnectionStatus | null> {
  const row = await getConnectorCredential(client, companyId, connectorId);
  if (!row) return null;
  return {
    companyId: row.company_id,
    connectorId: row.connector_id,
    status: row.status,
    accountEmail: row.account_email,
    scopes: row.scopes,
    lastSyncedAt: row.last_synced_at,
    accessTokenExpiresAt: row.access_token_expires_at,
  };
}
