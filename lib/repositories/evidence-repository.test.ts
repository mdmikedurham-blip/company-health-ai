import { describe, expect, it } from "vitest";
import { createEvidence } from "@/lib/connectors";
import { runInsightEngineFromRepository } from "@/lib/application";
import { InMemoryEvidenceRepository } from "./in-memory-evidence-repository";

function sampleEvidence(id: string) {
  return createEvidence({
    id,
    sourceSystem: "Google Drive",
    sourceType: "financial",
    title: `Doc ${id}`,
    contentSummary: "Cash runway is 4 months.",
    extractedFacts: { cashRunwayMonths: 4 },
    dimensionIds: ["dim-financial"],
    occurredAt: "2026-07-01T00:00:00.000Z",
    collectedAt: "2026-07-09T12:00:00.000Z",
    reliability: 80,
  });
}

describe("InMemoryEvidenceRepository", () => {
  it("upserts, lists, and deletes evidence", async () => {
    const repo = new InMemoryEvidenceRepository();
    await repo.upsert("co-1", [sampleEvidence("e1"), sampleEvidence("e2")]);
    expect((await repo.listByCompany("co-1")).map((e) => e.id).sort()).toEqual([
      "e1",
      "e2",
    ]);

    await repo.deleteByIds("co-1", ["e1"]);
    expect((await repo.listByCompany("co-1")).map((e) => e.id)).toEqual(["e2"]);

    await repo.replace("co-1", [sampleEvidence("e3")]);
    expect((await repo.listByCompany("co-1")).map((e) => e.id)).toEqual(["e3"]);
  });
});

describe("runInsightEngineFromRepository", () => {
  it("loads evidence from repository and runs the engine (no mock arrays)", async () => {
    const repo = new InMemoryEvidenceRepository();
    await repo.upsert("co-repo", [sampleEvidence("ev-runway")]);

    const result = await runInsightEngineFromRepository({
      companyId: "co-repo",
      repository: repo,
      asOf: "2026-07-09T13:42:00.000Z",
    });

    expect(result.loadedEvidenceCount).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.healthScore.score).toBeTypeOf("number");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
