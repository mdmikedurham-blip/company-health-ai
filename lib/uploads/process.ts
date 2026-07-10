import type { AppSupabaseClient } from "@/lib/supabase/client";
import { extractDocument, isExtractableMimeType } from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { createEvidenceRepository } from "@/lib/repositories/create-evidence-repository";
import {
  COMPANY_DOCUMENTS_BUCKET,
  MANUAL_UPLOAD_CONNECTOR_ID,
} from "./constants";

/**
 * Process QUEUED manual uploads for a company.
 * Downloads from Storage → extract → evidence upsert.
 * Does not run full company analysis (caller may trigger incremental later).
 */
export async function processQueuedManualUploads(input: {
  client: AppSupabaseClient;
  companyId: string;
  limit?: number;
}): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  evidenceIds: string[];
}> {
  const { data: rows, error } = await input.client
    .from("documents")
    .select(
      "id, title, filename, mime_type, storage_path, external_id, path, content_hash, modified_at, uri, metadata",
    )
    .eq("company_id", input.companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(input.limit ?? 20);

  if (error) {
    throw new Error(`processQueuedManualUploads.list: ${error.message}`);
  }

  const evidenceRepo = createEvidenceRepository({ client: input.client });
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const evidenceIds: string[] = [];

  for (const row of rows ?? []) {
    if (!row.storage_path || !row.mime_type) {
      skipped += 1;
      continue;
    }

    if (!isExtractableMimeType(row.mime_type)) {
      // Accepted for upload; extractors for PPTX/XLSX may arrive later.
      skipped += 1;
      continue;
    }

    await input.client
      .from("documents")
      .update({ status: "PROCESSING" })
      .eq("id", row.id)
      .eq("company_id", input.companyId);

    try {
      const { data: blob, error: downloadError } = await input.client.storage
        .from(COMPANY_DOCUMENTS_BUCKET)
        .download(row.storage_path);

      if (downloadError || !blob) {
        throw new Error(downloadError?.message ?? "download failed");
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const title = row.filename ?? row.title;
      const extracted = extractDocument({
        title,
        mimeType: row.mime_type,
        bytes,
        sourceMetadata: {
          document_id: row.id,
          storage_path: row.storage_path,
          source: "manual-upload",
        },
      });

      const now = new Date().toISOString();
      const item: RawConnectorItem = {
        externalId: row.external_id,
        title,
        syncedAt: now,
        rawSummary: extracted.text.slice(0, 500),
        path: row.path ?? title,
        modifiedAt: row.modified_at ?? undefined,
        mimeType: row.mime_type,
        contentHash: row.content_hash ?? undefined,
        metadata: {
          document_id: row.id,
          source: "manual-upload",
          ...(row.uri ? { uri: row.uri } : {}),
        },
      };

      const raw = rawDocumentFromConnectorItem(
        item,
        MANUAL_UPLOAD_CONNECTOR_ID,
        "Manual Upload",
      );
      const { evidence } = runEvidenceExtractionPipeline(raw, extracted, {
        evidenceId: `upload-${row.id}`,
      });

      await evidenceRepo.upsert(input.companyId, [evidence]);
      evidenceIds.push(evidence.id);

      await input.client
        .from("documents")
        .update({
          status: "PROCESSED",
          raw_summary: extracted.text.slice(0, 2000),
          synced_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("company_id", input.companyId);

      processed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await input.client
        .from("documents")
        .update({
          status: "FAILED",
          metadata: {
            source: "manual-upload",
            error: message.slice(0, 500),
          },
        })
        .eq("id", row.id)
        .eq("company_id", input.companyId);
    }
  }

  return { processed, failed, skipped, evidenceIds };
}
