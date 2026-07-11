import type { AppSupabaseClient } from "@/lib/supabase/client";
import {
  deleteEvidenceByIds,
  deleteFindingsByIds,
  deleteRisksByIds,
  listFindings,
  listRisks,
  upsertCompanyFindings,
  upsertCompanyRisks,
} from "@/lib/supabase/repository";
import { rebuildCompanyIntelligenceUnderLock } from "./company-analysis";
import { COMPANY_DOCUMENTS_BUCKET, MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import {
  canRemoveDocument,
  isLeaseExpired,
  isRemovalBlocked,
  requiresAnalysisRebuildOnRemove,
} from "./removal-policy";
import { recoverAbandonedManualUploadJobs } from "./stale-recovery";
import { logUploadProcessingEvent } from "./logging";

export type RemoveDocumentResult = {
  removed: boolean;
  alreadyGone?: boolean;
  documentId: string;
  companyId: string;
  storageDeleted: boolean;
  dbDeleted: boolean;
  evidenceDeleted: string[];
  findingsDeleted: string[];
  risksDeleted: string[];
  rebuiltAnalysis?: boolean;
  cleanupRequired?: boolean;
  orphanedStoragePath?: string | null;
  rebuildFailed?: boolean;
  errorMessage?: string;
};

function conflict(message: string): Error {
  const err = new Error(message);
  (err as Error & { status: number }).status = 409;
  return err;
}

function forbidden(message: string): Error {
  const err = new Error(message);
  (err as Error & { status: number }).status = 403;
  return err;
}

/**
 * Remove a manual-upload document for the authenticated company.
 * Tenant-scoped: companyId must match the document row (never trust the browser).
 */
export async function removeManualUploadDocument(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<RemoveDocumentResult> {
  const { client, companyId, documentId } = input;

  const { data: doc, error: loadError } = await client
    .from("documents")
    .select(
      "id, company_id, connector_id, status, storage_path, lease_expires_at, locked_at, processing_started_at, updated_at, metadata",
    )
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .maybeSingle();

  if (loadError) {
    throw new Error(`removeManualUploadDocument.load: ${loadError.message}`);
  }

  if (!doc) {
    // Distinguish cross-tenant (403) from truly missing (404 / alreadyGone).
    const { data: foreign, error: foreignError } = await client
      .from("documents")
      .select("id, company_id, connector_id")
      .eq("id", documentId)
      .maybeSingle();

    if (foreignError) {
      throw new Error(
        `removeManualUploadDocument.tenantCheck: ${foreignError.message}`,
      );
    }
    if (
      foreign &&
      (foreign.company_id !== companyId ||
        foreign.connector_id !== MANUAL_UPLOAD_CONNECTOR_ID)
    ) {
      throw forbidden("Forbidden");
    }

    return {
      removed: true,
      alreadyGone: true,
      documentId,
      companyId,
      storageDeleted: true,
      dbDeleted: true,
      evidenceDeleted: [],
      findingsDeleted: [],
      risksDeleted: [],
    };
  }

  // Stale leased PROCESSING: reclaim to QUEUED first, then remove as unprocessed.
  let current = doc;
  if (current.status === "PROCESSING" && isLeaseExpired(current)) {
    await recoverAbandonedManualUploadJobs({
      client,
      companyId,
      limit: 50,
    });

    const { data: reloaded, error: reloadError } = await client
      .from("documents")
      .select(
        "id, company_id, connector_id, status, storage_path, lease_expires_at, locked_at, processing_started_at, updated_at, metadata",
      )
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
      .maybeSingle();
    if (reloadError) {
      throw new Error(
        `removeManualUploadDocument.reload: ${reloadError.message}`,
      );
    }
    if (!reloaded) {
      return {
        removed: true,
        alreadyGone: true,
        documentId,
        companyId,
        storageDeleted: true,
        dbDeleted: true,
        evidenceDeleted: [],
        findingsDeleted: [],
        risksDeleted: [],
      };
    }
    current = reloaded;
  }

  if (isRemovalBlocked(current)) {
    throw conflict("Processing in progress");
  }

  if (!canRemoveDocument(current)) {
    throw conflict(`Document status ${current.status} cannot be removed.`);
  }

  if (requiresAnalysisRebuildOnRemove(current.status)) {
    return removeProcessedDocument({
      client,
      companyId,
      documentId,
      storagePath: current.storage_path,
      priorStatus: current.status,
    });
  }

  return removeUnprocessedDocument({
    client,
    companyId,
    documentId,
    storagePath: current.storage_path,
  });
}

async function removeUnprocessedDocument(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  storagePath: string | null;
}): Promise<RemoveDocumentResult> {
  const { client, companyId, documentId, storagePath } = input;

  const evidenceIds = await resolveEvidenceIds(
    client,
    companyId,
    documentId,
  );
  const { findingsDeleted, risksDeleted } = await cleanupSoleDependents(
    client,
    companyId,
    evidenceIds,
  );

  if (evidenceIds.length > 0) {
    await deleteEvidenceByIds(client, companyId, evidenceIds);
  }

  const storage = await deleteStorageObject({
    client,
    companyId,
    documentId,
    storagePath,
  });

  if (!storage.storageDeleted) {
    await markRemovalPartial({
      client,
      companyId,
      documentId,
      storagePath: storage.orphanedStoragePath ?? storagePath,
      errorMessage: storage.errorMessage ?? "storage delete failed",
    });
    return {
      removed: false,
      documentId,
      companyId,
      storageDeleted: false,
      dbDeleted: false,
      evidenceDeleted: evidenceIds,
      findingsDeleted,
      risksDeleted,
      orphanedStoragePath: storage.orphanedStoragePath ?? storagePath,
      errorMessage: storage.errorMessage,
    };
  }

  return finishDocumentRowDelete({
    client,
    companyId,
    documentId,
    storagePath,
    storageDeleted: true,
    evidenceDeleted: evidenceIds,
    findingsDeleted,
    risksDeleted,
  });
}

async function removeProcessedDocument(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  storagePath: string | null;
  priorStatus: string;
}): Promise<RemoveDocumentResult> {
  const { client, companyId, documentId, storagePath } = input;

  // Claim DELETING so concurrent workers / analysis cannot race the row.
  if (input.priorStatus !== "DELETING") {
    const { data: claimed, error: claimError } = await client
      .from("documents")
      .update({
        status: "DELETING",
        last_stage: "deleting",
        error_message: null,
        lease_expires_at: null,
        locked_at: null,
      })
      .eq("id", documentId)
      .eq("company_id", companyId)
      .eq("status", "PROCESSED")
      .select("id")
      .maybeSingle();

    if (claimError) {
      throw new Error(`removeProcessedDocument.claim: ${claimError.message}`);
    }
    if (!claimed) {
      throw conflict("Processing in progress");
    }
  }

  const evidenceIds = await resolveEvidenceIds(client, companyId, documentId);
  const { findingsDeleted, risksDeleted } = await cleanupSoleDependents(
    client,
    companyId,
    evidenceIds,
  );

  if (evidenceIds.length > 0) {
    await deleteEvidenceByIds(client, companyId, evidenceIds);
  }

  const storage = await deleteStorageObject({
    client,
    companyId,
    documentId,
    storagePath,
  });

  if (!storage.storageDeleted) {
    await markRemovalPartial({
      client,
      companyId,
      documentId,
      storagePath: storage.orphanedStoragePath ?? storagePath,
      errorMessage: storage.errorMessage ?? "storage delete failed",
      status: "DELETING",
    });
    return {
      removed: false,
      documentId,
      companyId,
      storageDeleted: false,
      dbDeleted: false,
      evidenceDeleted: evidenceIds,
      findingsDeleted,
      risksDeleted,
      orphanedStoragePath: storage.orphanedStoragePath ?? storagePath,
      errorMessage: storage.errorMessage,
    };
  }

  const rebuild = await rebuildCompanyIntelligenceUnderLock({
    client,
    companyId,
  });

  if (!rebuild.rebuilt) {
    const message =
      rebuild.errorMessage ??
      "Analysis rebuild failed after removing evidence.";
    await client
      .from("documents")
      .update({
        status: "DELETING",
        last_stage: "removal_rebuild_failed",
        error_message: message.slice(0, 1000),
        metadata: {
          source: "manual-upload",
          rebuild_failed: true,
          storage_deleted: true,
          evidence_deleted: evidenceIds,
        },
      })
      .eq("id", documentId)
      .eq("company_id", companyId);

    logUploadProcessingEvent("manual_upload_removal_partial", {
      documentId,
      companyId,
      stage: "rebuild",
      outcome: "rebuild_failed",
      errorMessage: message.slice(0, 500),
    });

    const err = new Error(message);
    (err as Error & { status: number; rebuildFailed: boolean }).status = 409;
    (err as Error & { rebuildFailed: boolean }).rebuildFailed = true;
    throw err;
  }

  return finishDocumentRowDelete({
    client,
    companyId,
    documentId,
    storagePath,
    storageDeleted: true,
    evidenceDeleted: evidenceIds,
    findingsDeleted,
    risksDeleted,
    rebuiltAnalysis: true,
  });
}

/**
 * Repair partial removals: finish DB delete, storage retry, or rebuild retry.
 */
export async function repairManualUploadRemoval(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<RemoveDocumentResult> {
  const { client, companyId, documentId } = input;
  const { data: doc, error } = await client
    .from("documents")
    .select("id, company_id, connector_id, status, storage_path, metadata, last_stage")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID)
    .maybeSingle();

  if (error) throw new Error(`repairManualUploadRemoval.load: ${error.message}`);
  if (!doc) {
    return {
      removed: true,
      alreadyGone: true,
      documentId,
      companyId,
      storageDeleted: true,
      dbDeleted: true,
      evidenceDeleted: [],
      findingsDeleted: [],
      risksDeleted: [],
    };
  }

  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const orphaned =
    typeof meta.orphaned_storage_path === "string"
      ? meta.orphaned_storage_path
      : doc.storage_path;

  if (orphaned && meta.orphaned_storage_path) {
    const { error: storageError } = await client.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove([orphaned]);
    if (storageError) {
      return {
        removed: false,
        documentId,
        companyId,
        storageDeleted: false,
        dbDeleted: false,
        evidenceDeleted: [],
        findingsDeleted: [],
        risksDeleted: [],
        orphanedStoragePath: orphaned,
        errorMessage: storageError.message,
      };
    }
  }

  if (
    doc.status === "DELETING" ||
    doc.last_stage === "removal_rebuild_failed" ||
    meta.rebuild_failed === true
  ) {
    return removeProcessedDocument({
      client,
      companyId,
      documentId,
      storagePath: doc.storage_path,
      priorStatus: "DELETING",
    });
  }

  return removeManualUploadDocument(input);
}

async function deleteStorageObject(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  storagePath: string | null;
}): Promise<{
  storageDeleted: boolean;
  orphanedStoragePath?: string | null;
  errorMessage?: string;
}> {
  const { client, companyId, documentId, storagePath } = input;
  if (!storagePath) return { storageDeleted: true };

  const { error: storageError } = await client.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .remove([storagePath]);

  if (!storageError) return { storageDeleted: true };

  const prefix = `${companyId}/${documentId}`;
  const { data: objects } = await client.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .list(prefix, { limit: 20 });
  if (objects && objects.length > 0) {
    const paths = objects.map((o) => `${prefix}/${o.name}`);
    const { error: batchError } = await client.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove(paths);
    if (!batchError) return { storageDeleted: true };
  }

  return {
    storageDeleted: false,
    orphanedStoragePath: storagePath,
    errorMessage: storageError.message,
  };
}

async function markRemovalPartial(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  storagePath: string | null;
  errorMessage: string;
  status?: string;
}): Promise<void> {
  await input.client
    .from("documents")
    .update({
      status: input.status ?? "FAILED",
      last_stage: "removal_partial",
      error_message: `orphaned_storage_path: ${input.storagePath}`,
      metadata: {
        source: "manual-upload",
        orphaned_storage_path: input.storagePath,
        removal_partial: true,
      },
    })
    .eq("id", input.documentId)
    .eq("company_id", input.companyId);

  logUploadProcessingEvent("manual_upload_removal_partial", {
    documentId: input.documentId,
    companyId: input.companyId,
    stage: "storage",
    outcome: "orphaned_storage_path",
    errorMessage: input.errorMessage.slice(0, 500),
  });
}

async function finishDocumentRowDelete(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
  storagePath: string | null;
  storageDeleted: boolean;
  evidenceDeleted: string[];
  findingsDeleted: string[];
  risksDeleted: string[];
  rebuiltAnalysis?: boolean;
}): Promise<RemoveDocumentResult> {
  const {
    client,
    companyId,
    documentId,
    storagePath,
    storageDeleted,
    evidenceDeleted,
    findingsDeleted,
    risksDeleted,
    rebuiltAnalysis,
  } = input;

  const { error: deleteError } = await client
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("connector_id", MANUAL_UPLOAD_CONNECTOR_ID);

  if (deleteError) {
    await client
      .from("documents")
      .update({
        metadata: {
          source: "manual-upload",
          cleanup_required: true,
          storage_deleted: storageDeleted,
          storage_path: storagePath,
        },
        last_stage: "cleanup_required",
        error_message: `cleanup_required: ${deleteError.message}`.slice(
          0,
          1000,
        ),
      })
      .eq("id", documentId)
      .eq("company_id", companyId);

    logUploadProcessingEvent("manual_upload_removal_partial", {
      documentId,
      companyId,
      stage: "db",
      outcome: "cleanup_required",
      errorMessage: deleteError.message.slice(0, 500),
    });

    return {
      removed: false,
      documentId,
      companyId,
      storageDeleted,
      dbDeleted: false,
      evidenceDeleted,
      findingsDeleted,
      risksDeleted,
      rebuiltAnalysis,
      cleanupRequired: true,
      errorMessage: deleteError.message,
    };
  }

  logUploadProcessingEvent("manual_upload_removal_completed", {
    documentId,
    companyId,
    stage: "removed",
    outcome: "removed",
  });

  return {
    removed: true,
    documentId,
    companyId,
    storageDeleted,
    dbDeleted: true,
    evidenceDeleted,
    findingsDeleted,
    risksDeleted,
    rebuiltAnalysis,
  };
}

async function resolveEvidenceIds(
  client: AppSupabaseClient,
  companyId: string,
  documentId: string,
): Promise<string[]> {
  const ids = new Set<string>([documentId]);
  const { data } = await client
    .from("evidence")
    .select("id")
    .eq("company_id", companyId)
    .eq("document_id", documentId);
  for (const row of data ?? []) ids.add(row.id);
  const { data: existing } = await client
    .from("evidence")
    .select("id")
    .eq("company_id", companyId)
    .in("id", [...ids]);
  return (existing ?? []).map((r) => r.id);
}

async function cleanupSoleDependents(
  client: AppSupabaseClient,
  companyId: string,
  evidenceIds: string[],
): Promise<{ findingsDeleted: string[]; risksDeleted: string[] }> {
  if (evidenceIds.length === 0) {
    return { findingsDeleted: [], risksDeleted: [] };
  }
  const idSet = new Set(evidenceIds);
  const findings = await listFindings(client, companyId);
  const risks = await listRisks(client, companyId);

  const findingsDeleted: string[] = [];
  const findingsToUpsert = [];

  for (const finding of findings) {
    const refs = finding.evidenceIds ?? [];
    const touches = refs.some((id) => idSet.has(id));
    if (!touches) continue;
    const remaining = refs.filter((id) => !idSet.has(id));
    if (remaining.length === 0) {
      findingsDeleted.push(finding.id);
    } else {
      findingsToUpsert.push({ ...finding, evidenceIds: remaining });
    }
  }

  const risksDeleted: string[] = [];
  const risksToUpsert = [];
  const deletedFindingSet = new Set(findingsDeleted);

  for (const risk of risks) {
    const refs = risk.evidenceIds ?? [];
    const findingRefs = risk.findingIds ?? [];
    const touchesEvidence = refs.some((id) => idSet.has(id));
    const touchesFindings = findingRefs.some((id) => deletedFindingSet.has(id));
    if (!touchesEvidence && !touchesFindings) continue;

    const remainingEvidence = refs.filter((id) => !idSet.has(id));
    const remainingFindings = findingRefs.filter(
      (id) => !deletedFindingSet.has(id),
    );

    if (remainingEvidence.length === 0 && remainingFindings.length === 0) {
      risksDeleted.push(risk.id);
    } else if (
      refs.length > 0 &&
      refs.every((id) => idSet.has(id)) &&
      remainingFindings.length === 0
    ) {
      risksDeleted.push(risk.id);
    } else {
      risksToUpsert.push({
        ...risk,
        evidenceIds: remainingEvidence,
        findingIds: remainingFindings,
      });
    }
  }

  await deleteFindingsByIds(client, companyId, findingsDeleted);
  await deleteRisksByIds(client, companyId, risksDeleted);
  if (findingsToUpsert.length > 0) {
    await upsertCompanyFindings(client, companyId, findingsToUpsert);
  }
  if (risksToUpsert.length > 0) {
    await upsertCompanyRisks(client, companyId, risksToUpsert);
  }

  return { findingsDeleted, risksDeleted };
}
