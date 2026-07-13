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
} from "@/lib/data/company-profile";
import {
  classifyCompanyFromEvidence,
} from "@/lib/classification";
import {
  getCompanyClassification,
  upsertCompanyClassificationFromResult,
} from "@/lib/classification/persist";
import {
  listEvidence,
  replaceCompanyRecommendations,
  replaceCompanyTimeline,
} from "@/lib/supabase/repository";
import {
  COMPANY_ANALYSIS_TIMEOUT_MS,
  MANUAL_UPLOAD_CONNECTOR_ID,
} from "./constants";
import {
  markDocumentProcessed,
  updateDocumentStage,
} from "./claim";
import {
  tryLockCompanyAnalysis,
  unlockCompanyAnalysis,
} from "./company-analysis-lock";
import { logUploadProcessingEvent } from "./logging";
import { createPipelineStageLogger } from "./pipeline-log";
import { sleep, withRetry } from "./retry";
import { evidenceIdForManualUpload } from "./removal-policy";
import { withTimeout } from "./timeout";
import {
  CURRENT_ANALYSIS_VERSION,
  CURRENT_EXTRACTION_VERSION,
} from "./versions";

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

async function refreshCompanyClassification(input: {
  client: AppSupabaseClient;
  companyId: string;
  snapshotId: string | null;
  scoredDimensionIds?: string[];
}): Promise<void> {
  const prior = await getCompanyClassification(input.client, input.companyId);
  const evidence = await listEvidence(input.client, input.companyId);
  const result = classifyCompanyFromEvidence({
    evidence,
    confirmed: prior?.confirmed,
    scoredDimensionIds: input.scoredDimensionIds,
  });
  await upsertCompanyClassificationFromResult({
    client: input.client,
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    result,
    priorConfirmed: prior?.confirmed,
    confirmedAt: prior?.confirmedAt ?? null,
    confirmedBy: prior?.confirmedBy ?? null,
  });
}

async function persistCompanyIntelligence(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentIds: string[];
}): Promise<void> {
  const { client, companyId, documentIds } = input;
  const now = new Date().toISOString();
  const evidenceIds = documentIds.map((id) => evidenceIdForManualUpload(id));
  const log = createPipelineStageLogger({
    companyId,
    documentId: documentIds[0],
    eventPrefix: "company_analysis",
  });

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

  const priorClassification = await getCompanyClassification(
    client,
    companyId,
  ).catch(() => null);

  log.stage("persist:start", {
    documentCount: documentIds.length,
  });

  const snapshot = await log.timed("insight_engine", () =>
    analyzeAndPersistIncremental({
      company,
      changedEvidenceIds: evidenceIds,
      dimensionProfiles,
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
      confirmedOverrides: priorClassification?.confirmed,
      classificationStage: priorClassification?.stage,
    }),
  );

  await log.timed("recommendations", () =>
    withRetry(async () => {
      await replaceCompanyRecommendations(
        client,
        companyId,
        snapshot.recommendations,
      );
    }),
  );

  await log.timed("timeline", () =>
    withRetry(async () => {
      await replaceCompanyTimeline(client, companyId, snapshot.timeline);
    }),
  );

  let snapshotId: string | null = null;
  try {
    snapshotId = await log.timed("assessment_snapshot", async () => {
      const { getCompanyAssessmentGoal } = await import("@/lib/assessment-goals");
      const { publishAssessmentSnapshot } = await import(
        "@/lib/assessment-snapshots"
      );
      const goalRow = await getCompanyAssessmentGoal({
        client,
        companyId,
      }).catch(() => null);

      const published = await publishAssessmentSnapshot({
        client,
        companyId,
        assessmentGoal: goalRow?.goal ?? "run-the-company",
        playbookVersion: (
          await import("@/lib/domain/playbook")
        ).PLAYBOOK_ENGINE_VERSION,
        companyStage: snapshot.classificationStage,
        generatedBy: "manual-upload",
        documentVersions: documentIds.map((id) => ({
          documentId: id,
        })),
        healthScore: snapshot.healthScore,
        dimensions: snapshot.dimensions,
        scoreChange: snapshot.scoreChange,
        findings: snapshot.findings,
        risks: snapshot.risks,
        recommendations: snapshot.recommendations,
        questionAnswers: snapshot.questionAnswers,
        questionCoverage: snapshot.questionCoverage,
        businessConcepts: snapshot.businessConcepts,
        evidenceIds,
        documentIds,
        syncCurrentTables: true,
      });
      return published.snapshotId;
    });
  } catch (error) {
    // Fallback: legacy sparse snapshot insert if Phase 6 publish is unavailable.
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId: documentIds[0] ?? "unknown",
      companyId,
      stage: "assessment_snapshot_publish",
      outcome: "deferred",
      status: "PROCESSED",
      errorMessage:
        error instanceof Error ? error.message : "snapshot_publish_failed",
    });
    await withRetry(async () => {
      const { error: insertError } = await client
        .from("analysis_snapshots")
        .insert({
          company_id: companyId,
          status: "completed",
          as_of: now,
          payload: {
            source: "manual-upload",
            documentIds,
            evidenceIds,
            healthScore: snapshot.healthScore.score,
            affected: snapshot.affected,
            classificationStage: snapshot.classificationStage ?? null,
          },
        });
      if (insertError) {
        throw new Error(`analysis_snapshots.insert: ${insertError.message}`);
      }
    });
    try {
      const { data } = await client
        .from("analysis_snapshots")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      snapshotId = data?.id ?? null;
    } catch {
      snapshotId = null;
    }

    try {
      const { replaceCompanyQuestionAnswers } = await import("@/lib/diligence");
      if (snapshot.questionAnswers?.length) {
        await replaceCompanyQuestionAnswers({
          client,
          companyId,
          answers: snapshot.questionAnswers.map((a) => ({
            ...a,
            snapshotId: snapshotId ?? a.snapshotId,
          })),
          snapshotId,
        });
      }
    } catch {
      // Migration 016 may not be applied yet.
    }

    try {
      const { replaceCompanyBusinessConcepts } = await import("@/lib/concepts");
      if (snapshot.businessConcepts?.length) {
        await replaceCompanyBusinessConcepts({
          client,
          companyId,
          concepts: snapshot.businessConcepts.map((c) => ({
            ...c,
            snapshotId: snapshotId ?? c.snapshotId,
          })),
          snapshotId,
        });
      }
    } catch {
      // Migration 017 may not be applied yet.
    }
  }

  try {
    await log.timed("classification", () =>
      refreshCompanyClassification({
        client,
        companyId,
        snapshotId,
        scoredDimensionIds: snapshot.dimensions
          .filter((d) => d.scored)
          .map((d) => d.id),
      }),
    );
  } catch (error) {
    logUploadProcessingEvent("manual_upload_processing_kickoff", {
      documentId: documentIds[0] ?? "unknown",
      companyId,
      stage: "classification",
      outcome: "deferred",
      status: "PROCESSED",
      errorMessage:
        error instanceof Error ? error.message : "classification_refresh_failed",
    });
  }

  log.stage("persist:done", {
    snapshotId: snapshotId ?? undefined,
    documentCount: documentIds.length,
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
        await withTimeout(
          persistCompanyIntelligence({
            client,
            companyId,
            documentIds: batchIds,
          }),
          COMPANY_ANALYSIS_TIMEOUT_MS,
          "company_analysis_persist",
        );
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
        logUploadProcessingEvent("manual_upload_processing_kickoff", {
          documentId: triggerDocumentId,
          companyId,
          stage: "company_analysis_persist",
          outcome: "failed",
          status: "EXTRACTED",
          errorMessage:
            error instanceof Error ? error.message : String(error),
          batchSize: batchIds.length,
        });
        throw error;
      }

      for (const documentId of batchIds) {
        await markDocumentProcessed({
          client,
          companyId,
          documentId,
          extractionVersion: CURRENT_EXTRACTION_VERSION,
          analysisVersion: CURRENT_ANALYSIS_VERSION,
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
