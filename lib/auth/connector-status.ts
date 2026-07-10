import type { AppSupabaseClient } from "@/lib/supabase";

export async function listLatestConnectorSync(
  client: AppSupabaseClient,
  companyId: string,
  connectorId: string,
) {
  const { data, error } = await client
    .from("connector_syncs")
    .select(
      "status, error_message, documents_analyzed, evidence_created, started_at, finished_at",
    )
    .eq("company_id", companyId)
    .eq("connector_id", connectorId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`listLatestConnectorSync: ${error.message}`);
  }
  return data;
}

export async function hasCompletedAnalysis(
  client: AppSupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("analysis_snapshots")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`hasCompletedAnalysis: ${error.message}`);
  }
  return Boolean(data);
}
