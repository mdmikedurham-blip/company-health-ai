import { NextResponse } from "next/server";
import { authErrorResponse, requirePrimaryCompany } from "@/lib/auth/session";
import {
  aggregateBusinessConcepts,
  BUSINESS_CONCEPT_CATALOG,
  BUSINESS_CONCEPT_CATALOG_VERSION,
  buildAllExplainabilityPaths,
  listCompanyBusinessConcepts,
} from "@/lib/concepts";
import { answerDiligenceQuestions } from "@/lib/diligence";
import { getCompanyClassification } from "@/lib/classification/persist";
import { createEvidenceRepository } from "@/lib/repositories";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/concepts
 * Exposes business concepts, confidence, supporting evidence/documents,
 * coverage, and contradictions for explainability.
 */
export async function GET() {
  try {
    const { ctx, companyId } = await requirePrimaryCompany();
    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { error: "Concepts API is not configured." },
        { status: 503 },
      );
    }

    const client = createServiceClient();
    const [evidence, classification, persisted] = await Promise.all([
      createEvidenceRepository({ client }).listByCompany(companyId),
      getCompanyClassification(client, companyId).catch(() => null),
      listCompanyBusinessConcepts({ client, companyId }).catch(() => []),
    ]);

    const asOf = new Date().toISOString();
    const concepts = aggregateBusinessConcepts({
      companyId,
      evidence,
      snapshotId: persisted[0]?.snapshotId ?? null,
      asOf,
    });

    const { answers } = answerDiligenceQuestions({
      companyId,
      evidence,
      concepts,
      stage: classification?.stage ?? null,
      asOf,
      snapshotId: persisted[0]?.snapshotId ?? null,
    });

    const contradictions = concepts
      .filter(
        (c) =>
          c.state === "contradicted" ||
          c.contradictingEvidenceIds.length > 0,
      )
      .map((c) => ({
        conceptId: c.conceptId,
        label: c.label,
        contradictingEvidenceIds: c.contradictingEvidenceIds,
        contradictingFactKeys: c.contradictingFactKeys,
        reasoning: c.reasoning,
      }));

    const meanConfidence =
      concepts.filter((c) => c.supportingFactKeys.length > 0).length === 0
        ? 0
        : Math.round(
            concepts
              .filter((c) => c.supportingFactKeys.length > 0)
              .reduce((s, c) => s + c.confidence, 0) /
              concepts.filter((c) => c.supportingFactKeys.length > 0).length,
          );

    return NextResponse.json({
      catalogVersion: BUSINESS_CONCEPT_CATALOG_VERSION,
      catalog: BUSINESS_CONCEPT_CATALOG,
      concepts,
      confidence: {
        mean: meanConfidence,
        method: "evidence_reliability_mean",
      },
      coverage: {
        conceptsWithFacts: concepts.filter((c) => c.supportingFactKeys.length > 0)
          .length,
        conceptsTotal: concepts.length,
        meanCoverage:
          Math.round(
            (concepts.reduce((s, c) => s + c.coverage, 0) / concepts.length) *
              1000,
          ) / 1000,
      },
      supportingEvidence: concepts.map((c) => ({
        conceptId: c.conceptId,
        evidenceIds: c.supportingEvidenceIds,
        factKeys: c.supportingFactKeys,
        factIds: c.supportingFactIds,
      })),
      supportingDocuments: concepts.map((c) => ({
        conceptId: c.conceptId,
        documentIds: c.supportingDocumentIds,
      })),
      contradictions,
      explainability: buildAllExplainabilityPaths({ answers, concepts }),
      provenance: {
        companyId,
        snapshotId: concepts[0]?.snapshotId ?? null,
        userId: ctx.user.id,
        evidenceCount: evidence.length,
      },
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }
}
