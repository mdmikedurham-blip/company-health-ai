import assert from "node:assert/strict";
import { FIXTURE_EVIDENCE } from "../connectors/fixtures/evidence";
import {
  computeHealthScore,
  deriveFindings,
  deriveInsights,
  deriveRecommendations,
  deriveRisks,
  runInsightEngine,
} from "./index";

const now = "2026-07-09T20:00:00.000Z";

function testFindingsFromEvidence() {
  const findings = deriveFindings(FIXTURE_EVIDENCE, now);
  assert.ok(findings.length >= 5, "expected multiple findings");
  assert.ok(
    findings.every((f) => f.evidenceIds.length > 0),
    "every finding must cite evidence",
  );
  assert.ok(
    findings.every((f) => f.confidence >= 0 && f.confidence <= 100),
    "confidence must be 0–100",
  );
}

function testRisksFromFindings() {
  const findings = deriveFindings(FIXTURE_EVIDENCE, now);
  const risks = deriveRisks(findings, now);
  assert.ok(risks.length >= 4, "expected multiple risks");
  assert.ok(
    risks.every((r) => r.findingIds.length > 0 && r.evidenceIds.length > 0),
    "risks must reference findings and evidence",
  );
  assert.ok(
    risks.some((r) => r.id === "risk-revenue-concentration"),
    "concentration risk should be present",
  );
}

function testHealthImpactFromRisks() {
  const findings = deriveFindings(FIXTURE_EVIDENCE, now);
  const risks = deriveRisks(findings, now);
  const health = computeHealthScore(risks, findings, FIXTURE_EVIDENCE, now);
  assert.ok(health.overall >= 0 && health.overall <= 100);
  assert.equal(health.dimensions.length, 8);
  assert.ok(health.evidenceCount === FIXTURE_EVIDENCE.length);
  const revenue = health.dimensions.find((d) => d.id === "revenue_quality");
  assert.ok(revenue, "revenue_quality dimension required");
  assert.ok(revenue!.score < 82, "revenue quality should be impacted by risks");
}

function testRecommendationsFromRisks() {
  const findings = deriveFindings(FIXTURE_EVIDENCE, now);
  const risks = deriveRisks(findings, now);
  const recs = deriveRecommendations(risks, now);
  assert.equal(recs.length, risks.length);
  assert.ok(recs.every((r) => r.evidenceIds.length > 0));
  assert.ok(
    recs[0].priority === "p0" || recs[0].priority === "p1",
    "highest priority recommendations should sort first",
  );
}

function testFullPipelineProducesCompanyDNA() {
  const result = runInsightEngine({
    companyId: "acme-corp",
    companyName: "Acme Corp",
    evidence: FIXTURE_EVIDENCE,
  });
  const { dna } = result;
  assert.equal(dna.companyId, "acme-corp");
  assert.ok(dna.insights.length >= 1);
  assert.ok(dna.timeline.length >= 1);
  assert.ok(dna.connectedSystems.includes("quickbooks"));
  assert.ok(dna.connectedSystems.includes("hubspot"));

  const insights = deriveInsights(result.findings, FIXTURE_EVIDENCE, now);
  assert.ok(insights.every((i) => i.evidenceIds.length > 0));
}

function testEmptyEvidenceIsSafe() {
  const result = runInsightEngine({
    companyId: "empty",
    companyName: "Empty Co",
    evidence: [],
  });
  assert.equal(result.findings.length, 0);
  assert.equal(result.risks.length, 0);
  assert.equal(result.dna.health.dimensions.length, 8);
  assert.ok(result.dna.health.overall > 0);
}

const tests = [
  testFindingsFromEvidence,
  testRisksFromFindings,
  testHealthImpactFromRisks,
  testRecommendationsFromRisks,
  testFullPipelineProducesCompanyDNA,
  testEmptyEvidenceIsSafe,
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`ok - ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`fail - ${test.name}`);
    console.error(err);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\n${tests.length} test(s) passed`);
