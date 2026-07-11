import type { AppSupabaseClient } from "@/lib/supabase/client";

/**
 * Postgres advisory lock wrappers for one analysis job per company.
 * Falls back to an in-process mutex when RPCs are unavailable (local tests).
 */

const localLocks = new Map<string, { owner: symbol }>();

export async function tryLockCompanyAnalysis(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<boolean> {
  const { data, error } = await input.client.rpc("try_lock_company_analysis", {
    p_company_id: input.companyId,
  });

  if (!error) return Boolean(data);

  // RPC missing / unavailable — in-process fallback (single isolate only).
  if (
    error.message.includes("try_lock_company_analysis") ||
    error.code === "PGRST202" ||
    error.code === "42883"
  ) {
    if (localLocks.has(input.companyId)) return false;
    localLocks.set(input.companyId, { owner: Symbol(input.companyId) });
    return true;
  }

  throw new Error(`tryLockCompanyAnalysis: ${error.message}`);
}

export async function unlockCompanyAnalysis(input: {
  client: AppSupabaseClient;
  companyId: string;
}): Promise<void> {
  const { error } = await input.client.rpc("unlock_company_analysis", {
    p_company_id: input.companyId,
  });

  if (!error) {
    localLocks.delete(input.companyId);
    return;
  }

  if (
    error.message.includes("unlock_company_analysis") ||
    error.code === "PGRST202" ||
    error.code === "42883"
  ) {
    localLocks.delete(input.companyId);
    return;
  }

  // Always clear local fallback; surface remote unlock errors.
  localLocks.delete(input.companyId);
  throw new Error(`unlockCompanyAnalysis: ${error.message}`);
}

/** Test helper — clear in-process locks between suites. */
export function resetLocalCompanyAnalysisLocks(): void {
  localLocks.clear();
}
