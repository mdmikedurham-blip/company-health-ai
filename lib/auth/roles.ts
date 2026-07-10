/**
 * Role authorization helpers (pure, testable).
 * Viewers can read; owners/admins/members can write; owners can delete company.
 */

import type { UserRole } from "@/lib/supabase";

const WRITE_ROLES: readonly UserRole[] = ["owner", "admin", "member"];
const ADMIN_ROLES: readonly UserRole[] = ["owner", "admin"];

export function canWriteCompanyData(role: UserRole | null | undefined): boolean {
  return role != null && WRITE_ROLES.includes(role);
}

export function canAdminCompany(role: UserRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

export function canDeleteCompany(role: UserRole | null | undefined): boolean {
  return role === "owner";
}

export function canManageMembers(role: UserRole | null | undefined): boolean {
  return canAdminCompany(role);
}

export function assertCanWrite(role: UserRole | null | undefined): void {
  if (!canWriteCompanyData(role)) {
    throw new Error("Insufficient permissions: write access required");
  }
}

export function assertCanDeleteCompany(role: UserRole | null | undefined): void {
  if (!canDeleteCompany(role)) {
    throw new Error("Insufficient permissions: owner role required");
  }
}
