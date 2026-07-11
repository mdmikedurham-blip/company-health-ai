/**
 * Serialized / coalesced company analysis for manual uploads.
 *
 * Extraction runs per-document concurrently. Analysis runs once per company:
 * advisory lock → debounce → analyze all EXTRACTED docs together → PROCESSED.
 *
 * Documents stay EXTRACTED when another worker holds the company lock;
 * they are never marked FAILED for that reason.
 */

import type { AppSupabaseClient } from "@/lib/supabase/client";
import { analyzeAndPersistIncremental } from "@/lib/application/incremental-analysis";
import { analyzeAndPersistFromStoredEvidence } from "@/lib/application/company-analysis-service";
import { buildSingleConnectorCatalog } from "@/lib/connectors/ingest";
import {
  companyBriefSeed,
  companyDNA as dnaProfile,
  companyProfile,
  companyReports,
  companyTimelineSeed,
  dimensionProfiles,
  previousHealthScore,
} from "@/lib/data/company-profile";
import {
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
} from "@/lib/supabase/repository";
import {
  tryLockCompanyAnalysis,
  unlockCompanyAnalysis,
} from "./company-analysis-lock";
import {
  markDocumentProcessed,
  updateDocumentStage,
} from "./claim";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import { logUploadProcessingEvent } from "./logging";
import { sleep, withRetry } from "./retry";
import { evidenceIdForManualUpload } from "./removal-policy";

/** Wait for late-arriving EXTRACTED siblings before analyzing. */
export const COMPANY_ANALYSIS_DEBOUNCE_MS = 750;

/** Max wait for another worker's analysis to finish our document. */
export const COMPANY_ANALYSIS_WAIT_MS = 60_000;

/** Poll interval while waiting on a peer analyzer. */
export const COMPANY_ANALYSIS_POLL_MS = 250;

export type CompanyAnalysisPassResult = {
  analyzedDocumentIds: string[];
  deferred: boolean;
  processed: boolean;
};

async function listExtractedDocumentIds(
  client: AppSupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "EXTRACTED")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`listExtractedDocumentIds: ${error.message}`);
  }
  return (data ?? []).map((row) => row.id);
}

async function getDocumentStatus(
  client: AppSupabaseClient,
  companyId: string,
  documentId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("documents")
    .select("status")
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`getDocumentStatus: ${error.message}`);
  }
  return data?.status ?? null;
}

async function markDocumentsAnalyzing(
  client: AppSupabaseClient,
  companyId: string,
  documentIds: string[],
): Promise<string[]> {
  const claimed: string[] = [];
  for (const documentId of documentIds) {
    const { data, error } = await client
      .from("documents")
      .update({
        status: "ANALYZING",
        last_stage: "analyzing",
        error_message: null,
      })
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("status", "EXTRACTED")
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`markDocumentsAnalyzing: ${error.message}`);
    }
    if (data?.id) claimed.push(data.id);
  }
  return claimed;
}

async function persistCompanyIntelligence(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentIds: string[];
}): Promise<void> {
  const { client, companyId, documentIds } = input;
  const now = new Date().toISOString();
  const evidenceIds = documentIds.map((id) => evidenceIdForManualUpload(id));

  const company =
    companyId === companyProfile.id
      ? companyProfile
      : { ...companyProfile, id: companyId, name: companyId };

  const { count: processedCount } = await client
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .eq("status", "PROCESSED");

  const snapshot = await analyzeAndPersistIncremental({
    company,
    changedEvidenceIds: evidenceIds,
    dimensionProfiles,
    previousHealthScore,
    dna: dnaProfile,
    reports: companyReports,
    timelineSeed: companyTimelineSeed,
    briefSeed: companyBriefSeed,
    evidenceCatalog: buildSingleConnectorCatalog({
      connectorId: MANUAL_UPLOAD_CONNECTOR_ID,
      name: "Manual Upload",
      system: "Manual Upload",
      documentsAnalyzed: (processedCount ?? 0) + documentIds.length,
      lastSynced: now,
      lastFullScan: now,
    }),
    client,
  });

  await withRetry(async () => {
    await replaceCompanyRecommendations(
      client,
      companyId,
      snapshot.recommendations,
    );
  });

  await withRetry(async () => {
    await replaceCompanyTimeline(client, companyId, snapshot.timeline);
  });

  await withRetry(async () => {
    const { error } = await client.from("analysis_snapshots").insert({
      company_id: companyId,
      status: "completed",
      as_of: now,
      payload: {
        source: "manual-upload",
        documentIds,
        evidenceIds,
        healthScore: snapshot.healthScore.score,
        affected: snapshot.affected,
      },
    });
    if (error) throw new Error(`analysis_snapshots.insert: ${error.message}`);
  });
}

/**
 * Acquire company lock (or wait for peer), debounce, analyze all EXTRACTED docs.
 */
export async function runCompanyAnalysisPass(input: {
  client: AppSupabaseClient;
  companyId: string;
  /** Document that triggered this pass — must end PROCESSED when possible. */
  triggerDocumentId: string;
  debounceMs?: number;
  waitMs?: number;
}): Promise<CompanyAnalysisPassResult> {
  const {
    client,
    companyId,
    triggerDocumentId,
    debounceMs = COMPANY_ANALYSIS_DEBOUNCE_MS,
    waitMs = COMPANY_ANALYSIS_WAIT_MS,
  } = input;

  const deadline = Date.now() + waitMs;
  let locked = false;

  while (Date.now() < deadline) {
    locked = await tryLockCompanyAnalysis({ client, companyId });
    if (locked) break;

    const status = await getDocumentStatus(client, companyId, triggerDocumentId);
    if (status === "PROCESSED") {
      return {
        analyzedDocumentIds: [triggerDocumentId],
        deferred: false,
        processed: true,
      };
    }
    if (status === "FAILED") {
      return {
        analyzedDocumentIds: [],
        deferred: false,
        processed: false,
      };
    }

    // Peer holds the lock — leave EXTRACTED; peer (or next loop) will include us.
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId: triggerDocumentId,
      companyId,
      stage: "company_analysis_wait",
      outcome: "deferred",
      status: status ?? "EXTRACTED",
    });
    await sleep(COMPANY_ANALYSIS_POLL_MS);
  }

  if (!locked) {
    // Timed out waiting — still do not FAIL for lock contention.
    const status = await getDocumentStatus(client, companyId, triggerDocumentId);
    return {
      analyzedDocumentIds: [],
      deferred: status === "EXTRACTED" || status === "ANALYZING",
      processed: status === "PROCESSED",
    };
  }

  const analyzedDocumentIds: string[] = [];

  try {
    // Debounce: wait briefly so concurrent extractors can land as EXTRACTED.
    let stable = false;
    let lastCount = -1;
    while (!stable) {
      await sleep(debounceMs);
      const ids = await listExtractedDocumentIds(client, companyId);
      if (ids.length === lastCount) {
        stable = true;
      } else {
        lastCount = ids.length;
      }
      // Cap debounce extensions so we cannot wait forever under continuous upload.
      if (Date.now() > deadline) break;
    }

    // Drain EXTRACTED batches while holding the lock.
    for (;;) {
      const extractedIds = await listExtractedDocumentIds(client, companyId);
      if (extractedIds.length === 0) break;

      const batchIds = await markDocumentsAnalyzing(
        client,
        companyId,
        extractedIds,
      );
      if (batchIds.length === 0) break;

      for (const documentId of batchIds) {
        logUploadProcessingEvent("manual_upload_processing_started", {
          documentId,
          companyId,
          stage: "analyzing",
          outcome: "started",
          status: "ANALYZING",
        });
      }

      try {
        await persistCompanyIntelligence({
          client,
          companyId,
          documentIds: batchIds,
        });
      } catch (error) {
        // Release ANALYZING → EXTRACTED so a later pass can retry; never leave orphans.
        for (const documentId of batchIds) {
          await updateDocumentStage({
            client,
            companyId,
            documentId,
            status: "EXTRACTED",
            lastStage: "extracted",
            patch: {
              lease_expires_at: null,
              locked_at: null,
              error_message: null,
            },
          });
        }
        throw error;
      }

      for (const documentId of batchIds) {
        await markDocumentProcessed({
          client,
          companyId,
          documentId,
        });
        analyzedDocumentIds.push(documentId);
        logUploadProcessingEvent("manual_upload_processing_completed", {
          documentId,
          companyId,
          stage: "processed",
          outcome: "processed",
          status: "PROCESSED",
        });
      }
    }

    const triggerStatus = await getDocumentStatus(
      client,
      companyId,
      triggerDocumentId,
    );

    return {
      analyzedDocumentIds,
      deferred: false,
      processed: triggerStatus === "PROCESSED",
    };
  } finally {
    await unlockCompanyAnalysis({ client, companyId });
  }
}

/**
 * Bounded parallel map for per-document extraction workers.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

export type RebuildCompanyIntelligenceResult = {
  rebuilt: boolean;
  deferred: boolean;
  errorMessage?: string;
};

/**
 * Full company rebuild from remaining stored evidence under the analysis lock.
 * Used after deleting a PROCESSED document's evidence.
 */
export async function rebuildCompanyIntelligenceUnderLock(input: {
  client: AppSupabaseClient;
  companyId: string;
  waitMs?: number;
}): Promise<RebuildCompanyIntelligenceResult> {
  const { client, companyId, waitMs = COMPANY_ANALYSIS_WAIT_MS } = input;
  const deadline = Date.now() + waitMs;
  let locked = false;

  while (Date.now() < deadline) {
    locked = await tryLockCompanyAnalysis({ client, companyId });
    if (locked) break;
    await sleep(COMPANY_ANALYSIS_POLL_MS);
  }

  if (!locked) {
    return {
      rebuilt: false,
      deferred: true,
      errorMessage:
        "Company analysis is busy. Retry removal after processing finishes.",
    };
  }

  try {
    const now = new Date().toISOString();
    const company =
      companyId === companyProfile.id
        ? companyProfile
        : { ...companyProfile, id: companyId, name: companyId };

    // Count remaining PROCESSED docs only (the target is already DELETING).
    const { count: processedCount } = await client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .eq("status", "PROCESSED");

    await withRetry(async () => {
      await analyzeAndPersistFromStoredEvidence({
        company,
        lastFullScan: now,
        dimensionProfiles,
        previousHealthScore,
        dna: dnaProfile,
        reports: companyReports,
        timelineSeed: companyTimelineSeed,
        briefSeed: companyBriefSeed,
        evidenceCatalog: buildSingleConnectorCatalog({
          connectorId: MANUAL_UPLOAD_CONNECTOR_ID,
          name: "Manual Upload",
          system: "Manual Upload",
          documentsAnalyzed: processedCount ?? 0,
          lastSynced: now,
          lastFullScan: now,
        }),
        asOf: now,
        client,
      });
    });

    await withRetry(async () => {
      const { error } = await client.from("analysis_snapshots").insert({
        company_id: companyId,
        status: "completed",
        as_of: now,
        payload: {
          source: "manual-upload-removal-rebuild",
          documentsAnalyzed: processedCount ?? 0,
        },
      });
      if (error) throw new Error(`analysis_snapshots.insert: ${error.message}`);
    });

    return { rebuilt: true, deferred: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      rebuilt: false,
      deferred: false,
      errorMessage: message,
    };
  } finally {
    await unlockCompanyAnalysis({ client, companyId });
  }
}
