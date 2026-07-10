import type { RawConnectorItem } from "../connector";

/**
 * Google Drive crawl / list helpers.
 * Mock adapters supply items via createMockConnector; this module is the
 * seam for a real Drive API listing later.
 */

export interface GoogleDriveCrawlOptions {
  folderIds?: string[];
  mimeTypes?: string[];
  pageSize?: number;
}

/** Placeholder — real implementation will page Drive files into RawConnectorItem[]. */
export async function crawlGoogleDrive(
  _accessToken: string,
  _options: GoogleDriveCrawlOptions = {},
): Promise<RawConnectorItem[]> {
  return [];
}
