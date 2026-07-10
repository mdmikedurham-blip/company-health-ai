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
import { COMPANY_DOCUMENTS_BUCKET, MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";
import {
  canRemoveDocument,
  evidenceIdForManualUpload,
  isActivelyProcessing,
} from "./removal-policy";
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
  cleanupRequired?: boolean;
  orphanedStoragePath?: string | null;
  errorMessage?: string;
};

/**
 * Remove a manual-upload document for the authenticated company.
 * Tenant-scoped: companyId must match the document row.
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

  if (isActivelyProcessing(doc)) {
    const err = new Error(
      "Document is actively processing. Cancel processing before removing.",
    );
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  if (!canRemoveDocument(doc)) {
    const err = new Error(
      `Document status ${doc.status} cannot be removed.`,
    );
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const evidenceId = evidenceIdForManualUpload(documentId);
  const evidenceIds = await resolveEvidenceIds(client, companyId, documentId, evidenceId);
  const { findingsDeleted, risksDeleted } = await cleanupSoleDependents(
    client,
    companyId,
    evidenceIds,
  );

  if (evidenceIds.length > 0) {
    await deleteEvidenceByIds(client, companyId, evidenceIds);
  }

  let storageDeleted = false;
  const storagePath = doc.storage_path;

  if (storagePath) {
    const { error: storageError } = await client.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      // Also try deleting the document folder prefix objects.
      const prefix = `${companyId}/${documentId}`;
      const { data: objects } = await client.storage
        .from(COMPANY_DOCUMENTS_BUCKET)
        .list(prefix, { limit: 20 });
      if (objects && objects.length > 0) {
        const paths = objects.map((o) => `${prefix}/${o.name}`);
        const { error: batchError } = await client.storage
          .from(COMPANY_DOCUMENTS_BUCKET)
          .remove(paths);
        storageDeleted = !batchError;
      }
      if (!storageDeleted) {
        await client
          .from("documents")
          .update({
            status: "FAILED",
            last_stage: "removal_partial",
            error_message: `orphaned_storage_path: ${storagePath}`,
            metadata: {
              source: "manual-upload",
              orphaned_storage_path: storagePath,
              removal_partial: true,
            },
          })
          .eq("id", documentId)
          .eq("company_id", companyId);

        logUploadProcessingEvent("manual_upload_removal_partial", {
          documentId,
          companyId,
          stage: "storage",
          outcome: "orphaned_storage_path",
          errorMessage: storageError.message.slice(0, 500),
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
          orphanedStoragePath: storagePath,
          errorMessage: storageError.message,
        };
      }
    } else {
      storageDeleted = true;
    }
  } else {
    storageDeleted = true;
  }

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
        error_message: `cleanup_required: ${deleteError.message}`.slice(0, 1000),
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
      evidenceDeleted: evidenceIds,
      findingsDeleted,
      risksDeleted,
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
    evidenceDeleted: evidenceIds,
    findingsDeleted,
    risksDeleted,
  };
}

/**
 * Repair partial removals: finish DB delete or retry storage delete.
 */
export async function repairManualUploadRemoval(input: {
  client: AppSupabaseClient;
  companyId: string;
  documentId: string;
}): Promise<RemoveDocumentResult> {
  const { client, companyId, documentId } = input;
  const { data: doc, error } = await client
    .from("documents")
    .select("id, company_id, connector_id, status, storage_path, metadata")
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
  const cleanupRequired = meta.cleanup_required === true;

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

  if (cleanupRequired || meta.orphaned_storage_path || orphaned) {
    // Finish removal via the normal path now that storage is clear / retryable.
    return removeManualUploadDocument(input);
  }

  return removeManualUploadDocument(input);
}

async function resolveEvidenceIds(
  client: AppSupabaseClient,
  companyId: string,
  documentId: string,
  conventionalId: string,
): Promise<string[]> {
  const ids = new Set<string>([conventionalId]);
  const { data } = await client
    .from("evidence")
    .select("id")
    .eq("company_id", companyId)
    .eq("document_id", documentId);
  for (const row of data ?? []) ids.add(row.id);
  // Keep only ids that actually exist (conventional may be absent).
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
    const remainingFindings = findingRefs.filter((id) => !deletedFindingSet.has(id));

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
