/**
 * Demo mode is opt-in only. Production authenticated tenants must never
 * fall back to Acme seed data.
 */
export const DEMO_COMPANY_ID = "company-acme" as const;

export function isDemoModeEnabled(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

/** True only for the explicit demo route / demo tenant, never for real company UUIDs. */
export function isDemoCompanyId(companyId: string | null | undefined): boolean {
  return companyId === DEMO_COMPANY_ID;
}
