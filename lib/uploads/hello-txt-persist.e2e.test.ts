import { describe, expect, it } from "vitest";
import { extractDocument } from "@/lib/connectors/extraction";
import { runEvidenceExtractionPipeline } from "@/lib/connectors/documents/pipeline";
import { rawDocumentFromConnectorItem } from "@/lib/connectors/documents/bridges";
import type { RawConnectorItem } from "@/lib/connectors/connector";
import { runInsightEngine } from "@/lib/intelligence";
import {
  evidenceToInsert,
  findingToInsert,
  healthScoreToInsert,
  recommendationToInsert,
  riskToInsert,
  timelineEventToInsert,
} from "@/lib/supabase/mappers";
import { isUuid } from "./evidence-id";
import {
  evidenceIdForManualUpload,
  manualUploadExternalKey,
} from "./removal-policy";
import { companyTimelineSeed } from "@/lib/data/company-profile";
import { MANUAL_UPLOAD_CONNECTOR_ID } from "./constants";

/**
 * hello.txt body includes extractable facts so the Insight Engine emits
 * findings/risks/recommendations (bare "hello" alone does not).
 */
const HELLO_BODY =
  "hello\nCash runway is 6 months with elevated burn versus forecast. Top 3 customers are 58% of ARR.\n";

/** Production document id from the FAILED timeline insert error. */
const DOC_UUID = "6b0bdf42-82a5-4494-a02f-6f0fbe4da5c0";
const COMPANY_UUID = "11111111-2222-4333-8444-555555555555";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string | null | undefined, label: string) {
  expect(value, label).toMatch(UUID_RE);
  expect(value, label).not.toMatch(/^tl-/);
  expect(value, label).not.toMatch(/^(finding|risk|rec)-/);
  expect(isUuid(value!)).toBe(true);
}

describe("hello.txt manual-upload → timeline persistence UUID regression", () => {
  it("reaches PROCESSED artifacts: evidence, findings, risks, recs, health, timeline, snapshot shape", () => {
    const extracted = extractDocument({
      title: "hello.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(HELLO_BODY),
    });
    expect(extracted.text).toContain("hello");
    expect(extracted.text).toContain("runway");

    const now = "2026-07-11T18:32:10.000Z";
    const item: RawConnectorItem = {
      externalId: DOC_UUID,
      title: "hello.txt",
      syncedAt: now,
      rawSummary: extracted.text.slice(0, 500),
      path: "hello.txt",
      mimeType: "text/plain",
      metadata: {
        document_id: DOC_UUID,
        source: MANUAL_UPLOAD_CONNECTOR_ID,
      },
    };
    const raw = rawDocumentFromConnectorItem(
      item,
      MANUAL_UPLOAD_CONNECTOR_ID,
      "Manual Upload",
    );
    const { evidence: pipelineEvidence } = runEvidenceExtractionPipeline(
      raw,
      extracted,
      { evidenceId: evidenceIdForManualUpload(DOC_UUID) },
    );
    const evidence = {
      ...pipelineEvidence,
      id: DOC_UUID,
      metadata: {
        ...pipelineEvidence.metadata,
        documentId: DOC_UUID,
        externalKey: manualUploadExternalKey(DOC_UUID),
        source: MANUAL_UPLOAD_CONNECTOR_ID,
      },
    };
    assertUuid(evidence.id, "evidence.id");

    const engine = runInsightEngine({
      companyId: COMPANY_UUID,
      evidence: [evidence],
      documents: [
        {
          id: DOC_UUID,
          title: "hello.txt",
          connectorId: MANUAL_UPLOAD_CONNECTOR_ID,
          contentHash: "hello-hash",
        },
      ],
      evidenceDocumentIds: { [DOC_UUID]: DOC_UUID },
      asOf: now,
    });

    expect(engine.findings.length).toBeGreaterThan(0);
    expect(engine.risks.length).toBeGreaterThan(0);
    expect(engine.recommendations.length).toBeGreaterThan(0);
    expect(engine.healthScore.score).toBeGreaterThan(0);
    expect(engine.timelineEvents.length).toBeGreaterThan(0);
    expect(engine.timelineEvents.some((e) => e.type === "evidence-created")).toBe(
      true,
    );
    expect(engine.timelineEvents.some((e) => e.type === "finding-created")).toBe(
      true,
    );
    expect(engine.timelineEvents.some((e) => e.type === "risk-created")).toBe(
      true,
    );

    const evidenceRow = evidenceToInsert(COMPANY_UUID, evidence, DOC_UUID);
    assertUuid(evidenceRow.id, "evidence insert id");

    for (const finding of engine.findings) {
      const row = findingToInsert(COMPANY_UUID, finding);
      assertUuid(row.id, `finding insert id (${finding.id})`);
      expect(row.stable_key).toBe(finding.id);
      expect(row.stable_key).toMatch(/^finding-/);
    }
    for (const risk of engine.risks) {
      const row = riskToInsert(COMPANY_UUID, risk);
      assertUuid(row.id, `risk insert id (${risk.id})`);
      expect(row.stable_key).toBe(risk.id);
      expect(row.stable_key).toMatch(/^risk-/);
    }
    for (const rec of engine.recommendations) {
      const row = recommendationToInsert(COMPANY_UUID, rec);
      assertUuid(row.id, `recommendation insert id (${rec.id})`);
      expect(row.stable_key).toBe(rec.id);
      expect(row.stable_key).toMatch(/^rec-/);
    }

    const healthRow = healthScoreToInsert(
      COMPANY_UUID,
      engine.healthScore,
      engine.dimensions,
      engine.scoreChange,
    );
    expect(healthRow.id).toBeUndefined();
    expect(healthRow.company_id).toBe(COMPANY_UUID);
    expect(Number(healthRow.score)).toBe(engine.healthScore.score);

    const snapshotPayload = {
      company_id: COMPANY_UUID,
      status: "completed" as const,
      as_of: now,
      payload: {
        source: "manual-upload",
        documentId: DOC_UUID,
        evidenceId: evidence.id,
        healthScore: engine.healthScore.score,
        affected: {
          findingIds: engine.findings.map((f) => f.id),
          riskIds: engine.risks.map((r) => r.id),
        },
      },
    };
    expect(snapshotPayload.payload.evidenceId).toBe(DOC_UUID);
    assertUuid(snapshotPayload.payload.documentId, "snapshot documentId");

    const timeline = [...engine.timelineEvents, ...companyTimelineSeed];
    for (const event of timeline) {
      assertUuid(event.id, `engine/seed timeline id (${event.type})`);
      const row = timelineEventToInsert(COMPANY_UUID, event);
      assertUuid(row.id, `timeline insert id (${event.type})`);
      if (row.parent_event_id) {
        assertUuid(row.parent_event_id, "parent_event_id");
      }
      if (row.root_event_id) {
        assertUuid(row.root_event_id, "root_event_id");
      }
      expect(row.id).not.toMatch(/^tl-/);
      expect(String(row.event_key ?? "")).toMatch(/^tl-/);
      expect(row.metadata).toMatchObject({
        eventKey: expect.stringMatching(/^tl-/),
      });
    }

    const evidenceCreated = timeline
      .map((e) => timelineEventToInsert(COMPANY_UUID, e))
      .find((r) => r.type === "evidence-created");
    expect(evidenceCreated).toBeDefined();
    assertUuid(evidenceCreated!.id, "evidence-created timeline id");
    expect(evidenceCreated!.id).not.toBe(`tl-evidence-created-${DOC_UUID}`);
    expect(evidenceCreated!.event_key).toBe(`tl-evidence-created-${DOC_UUID}`);
  });
});
