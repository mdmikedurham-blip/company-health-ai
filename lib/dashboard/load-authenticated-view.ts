import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase";
import { getSessionContext } from "@/lib/auth/session";
import {
  emptyTenantDashboard,
  loadTenantDashboard,
  type TenantDashboardView,
} from "@/lib/dashboard";

/**
 * Shared loader for authenticated intelligence pages.
 * Returns empty_state when there is no persisted analysis — never Acme seed.
 */
export async function loadAuthenticatedDashboardView(): Promise<{
  view: TenantDashboardView;
  companyName: string | undefined;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
}> {
  const ctx = await getSessionContext();
  const companyId = ctx?.primaryCompanyId ?? null;
  const companyName = ctx?.memberships.find(
    (m) => m.companyId === ctx.primaryCompanyId,
  )?.companyName;
  const userName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    ctx?.user.email ??
    null;

  if (!companyId || !isServiceRoleConfigured()) {
    return {
      view: emptyTenantDashboard({
        companyId: companyId ?? "unknown",
        companyName: companyName ?? "Your company",
      }),
      companyName,
      userName,
      userEmail: ctx?.user.email ?? null,
      companyId,
    };
  }

  const client: AppSupabaseClient = createServiceClient();
  const view = await loadTenantDashboard({
    client,
    companyId,
    companyName: companyName ?? "Your company",
  });

  return {
    view,
    companyName,
    userName,
    userEmail: ctx?.user.email ?? null,
    companyId,
  };
}
