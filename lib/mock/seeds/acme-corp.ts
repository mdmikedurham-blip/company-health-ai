/**
 * Legacy seed re-exports — prefer `@/lib/data` for application reads.
 * Kept so older imports of acmePlatformInput continue to resolve.
 */
import {
  companyDNA,
  companyExecutiveBrief,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import { acmeConnectors } from "@/lib/connectors";
import type { PlatformInput } from "@/lib/connectors";

export const acmePlatformInput: PlatformInput = {
  connectors: acmeConnectors,
  lastFullScan: "Today, 5:00 AM",
  company: companyProfile,
  dimensions: dimensionProfiles,
  previousHealthScore,
  dna: companyDNA,
  reports: companyReports,
  timeline: companyTimelineSeed,
  executiveBrief: companyExecutiveBrief,
};
