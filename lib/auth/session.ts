import type { User } from "@supabase/supabase-js";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
  type AppSupabaseClient,
  type UserRole,
} from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertCompanyAccess,
  pickPrimaryCompanyId,
} from "@/lib/auth/route-guards";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type CompanyMembership = {
  companyId: string;
  role: UserRole;
  createdAt: string;
  companyName?: string;
};

export type SessionContext = {
  user: User;
  memberships: CompanyMembership[];
  primaryCompanyId: string | null;
};

export async function getSessionUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

export async function listMembershipsForUser(
  userId: string,
  client?: AppSupabaseClient,
): Promise<CompanyMembership[]> {
  if (!isSupabaseConfigured()) return [];
  const db = client ?? createServiceClient();
  const { data, error } = await db
    .from("company_members")
    .select("company_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`listMembershipsForUser: ${error.message}`);
  }

  const memberships = data ?? [];
  if (memberships.length === 0) return [];

  const companyIds = memberships.map((row) => row.company_id);
  const { data: companies } = await db
    .from("companies")
    .select("id, name")
    .in("id", companyIds);

  const nameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  return memberships.map((row) => ({
    companyId: row.company_id,
    role: row.role as UserRole,
    createdAt: row.created_at,
    companyName: nameById.get(row.company_id),
  }));
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await listMembershipsForUser(user.id);
  return {
    user,
    memberships,
    primaryCompanyId: pickPrimaryCompanyId(memberships),
  };
}

export async function requireSessionContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    throw new AuthError("Authentication required", 401);
  }
  return ctx;
}

export async function requireCompanyMembership(
  companyId: string | null | undefined,
  ctx?: SessionContext,
): Promise<{ ctx: SessionContext; companyId: string }> {
  const session = ctx ?? (await requireSessionContext());
  const allowed = assertCompanyAccess(
    session.memberships.map((m) => m.companyId),
    companyId,
  );
  return { ctx: session, companyId: allowed };
}

export async function requirePrimaryCompany(): Promise<{
  ctx: SessionContext;
  companyId: string;
}> {
  const ctx = await requireSessionContext();
  if (!ctx.primaryCompanyId) {
    throw new AuthError("Company onboarding required", 403);
  }
  return { ctx, companyId: ctx.primaryCompanyId };
}

export async function ensureProfileForUser(user: User): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  const db = createServiceClient();
  await db.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
    },
    { onConflict: "id" },
  );
}

export async function createCompanyWorkspace(input: {
  userId: string;
  email: string;
  fullName?: string | null;
  companyName: string;
}): Promise<{ companyId: string }> {
  if (!isServiceRoleConfigured()) {
    throw new Error("Supabase service role is not configured");
  }

  const name = input.companyName.trim();
  if (!name) {
    throw new Error("Company name is required");
  }

  const db = createServiceClient();

  await db.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email,
      full_name: input.fullName ?? null,
    },
    { onConflict: "id" },
  );

  const existing = await listMembershipsForUser(input.userId, db);
  if (existing.length > 0) {
    return { companyId: existing[0]!.companyId };
  }

  const { data: company, error: companyError } = await db
    .from("companies")
    .insert({ name })
    .select("id")
    .single();

  if (companyError || !company) {
    throw new Error(
      `Failed to create company: ${companyError?.message ?? "unknown"}`,
    );
  }

  const { error: memberError } = await db.from("company_members").insert({
    company_id: company.id,
    user_id: input.userId,
    role: "owner",
  });

  if (memberError) {
    throw new Error(`Failed to add company owner: ${memberError.message}`);
  }

  return { companyId: company.id };
}

export function authErrorResponse(err: unknown): {
  message: string;
  status: number;
} {
  if (err instanceof AuthError) {
    return { message: err.message, status: err.status };
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message === "Unauthorized company access") {
    return { message, status: 403 };
  }
  return { message, status: 500 };
}
