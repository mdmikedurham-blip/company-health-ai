/**
 * Legacy seed re-exports — prefer `@/lib/data` for application reads.
 */
import {
  companyBriefSeed,
  companyDNA,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import { acmeConnectors } from "@/lib/connectors";
import type { PlatformInput } from "@/lib/connectors";
import { DEFAULT_AS_OF } from "@/lib/intelligence";

export const acmePlatformInput: PlatformInput = {
  company: companyProfile,
  connectors: acmeConnectors,
  lastFullScan: "Today, 5:00 AM",
  dimensionProfiles,
  previousHealthScore,
  dna: companyDNA,
  reports: companyReports,
  timelineSeed: companyTimelineSeed,
  briefSeed: companyBriefSeed,
  asOf: DEFAULT_AS_OF,
};
