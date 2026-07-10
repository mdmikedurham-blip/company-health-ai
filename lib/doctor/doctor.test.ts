import { describe, expect, it } from "vitest";
import { companySnapshot } from "@/lib/data";
import { createMockLLMProvider } from "@/lib/ai/mock-llm-provider";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { buildDoctorContext, toEvidenceCitation } from "./context-builder";
import { classifyQuery } from "./query-classifier";
import {
  askDoctor,
  enforceCitationIntegrity,
} from "./doctor-service";
import { retrieveRelevantContext } from "./retriever";
import type { DoctorAnswer, DoctorContext } from "./types";

describe("query classifier", () => {
  it("classifies governance score questions", () => {
    const q = classifyQuery("Why is governance only 71?");
    expect(q.intent).toBe("governance");
    expect(q.dimensionHints).toContain("dim-governance");
  });

  it("classifies customer concentration questions", () => {
    const q = classifyQuery("Show evidence for customer concentration.");
    expect(q.intent).toBe("customer_concentration");
    expect(q.dimensionHints).toContain("dim-customer");
  });

  it("marks off-topic questions as unsupported", () => {
    const q = classifyQuery("What is the weather in Paris today?");
    expect(q.intent).toBe("unsupported");
  });
});

describe("retriever — governance", () => {
  it("ranks governance evidence, findings, and risks highly", () => {
    const query = classifyQuery("Why is governance only 71?");
    const result = retrieveRelevantContext(companySnapshot, query);

    expect(result.insufficientEvidence).toBe(false);
    expect(result.evidence.some((e) => e.item.id === "ev-equity-grants")).toBe(
      true,
    );
    expect(
      result.risks.some((r) => r.item.id === "risk-board-approval"),
    ).toBe(true);
    expect(
      result.dimensions.some((d) => d.item.id === "dim-governance"),
    ).toBe(true);

    const topEvidence = result.evidence[0]!;
    expect(topEvidence.score).toBeGreaterThanOrEqual(
      result.evidence.at(-1)?.score ?? 0,
    );
  });
});

describe("retriever — customer concentration", () => {
  it("ranks ARR cohort and concentration risk first", () => {
    const query = classifyQuery("Show evidence for customer concentration.");
    const result = retrieveRelevantContext(companySnapshot, query);

    expect(result.insufficientEvidence).toBe(false);
    expect(result.evidence[0]?.item.id).toBe("ev-arr-cohort");
    expect(result.risks.some((r) => r.item.id === "risk-concentration")).toBe(
      true,
    );
    expect(
      result.findings.some((f) => f.item.id === "finding-concentration"),
    ).toBe(true);
    expect(
      result.recommendations.some(
        (r) => r.item.id === "rec-diversify-customers",
      ),
    ).toBe(true);
  });
});

describe("retriever — deterministic ranking", () => {
  it("returns identical ranking for the same question", () => {
    const query = classifyQuery("What are the biggest risks?");
    const a = retrieveRelevantContext(companySnapshot, query);
    const b = retrieveRelevantContext(companySnapshot, query);

    expect(a.risks.map((r) => r.item.id)).toEqual(
      b.risks.map((r) => r.item.id),
    );
    expect(a.risks.map((r) => r.score)).toEqual(b.risks.map((r) => r.score));
    expect(a.evidence.map((e) => e.item.id)).toEqual(
      b.evidence.map((e) => e.item.id),
    );
  });

  it("sorts ties by id for stability", () => {
    const query = classifyQuery("What are the biggest risks?");
    const result = retrieveRelevantContext(companySnapshot, query);
    const scores = result.risks.map((r) => r.score);
    for (let i = 1; i < result.risks.length; i++) {
      if (scores[i] === scores[i - 1]) {
        expect(
          result.risks[i - 1]!.item.id < result.risks[i]!.item.id,
        ).toBe(true);
      } else {
        expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
      }
    }
  });
});

describe("unsupported / insufficient evidence", () => {
  it("returns insufficient-evidence for unsupported questions", async () => {
    const result = await askDoctor({
      question: "Write me a poem about cats",
    });

    expect(result.classified.intent).toBe("unsupported");
    expect(result.answer.insufficientEvidence).toBe(true);
    expect(result.answer.confidence).toBeLessThan(40);
    expect(result.answer.evidenceCitations).toHaveLength(0);
    expect(result.answer.answer.toLowerCase()).toMatch(
      /outside|only answer|scope|company health/,
    );
  });

  it("does not fabricate evidence for nonsense in-domain questions", async () => {
    const result = await askDoctor({
      question: "What is our quantum entanglement compliance score?",
    });

    expect(result.answer.insufficientEvidence).toBe(true);
    expect(result.answer.confidence).toBeLessThan(40);
    for (const c of result.answer.evidenceCitations) {
      expect(companySnapshot.evidence.some((e) => e.id === c.id)).toBe(true);
    }
  });
});

describe("citation integrity", () => {
  it("strips fabricated evidence ids and never invents citations", () => {
    const allowed = new Set(companySnapshot.evidence.map((e) => e.id));
    const snapshotCitations = companySnapshot.evidence.map(toEvidenceCitation);

    const dirty: DoctorAnswer = {
      answer:
        "Concentration is high [ev-arr-cohort] and also [ev-fabricated-999].",
      summary: "Bad cite [ev-fabricated-999]",
      riskLevel: "high",
      confidence: 90,
      evidenceCitations: [
        {
          id: "ev-arr-cohort",
          label: "HubSpot · ARR cohort analysis",
          sourceSystem: "HubSpot",
          title: "ARR cohort analysis",
          href: "/evidence?id=ev-arr-cohort",
        },
        {
          id: "ev-fabricated-999",
          label: "Fake",
          sourceSystem: "Fake",
          title: "Fake",
          href: "/evidence?id=ev-fabricated-999",
        },
      ],
      relevantFindings: [],
      relevantRisks: [],
      recommendedActions: [],
      limitations: [],
      insufficientEvidence: false,
    };

    const clean = enforceCitationIntegrity(dirty, allowed, snapshotCitations);

    expect(clean.evidenceCitations.every((c) => allowed.has(c.id))).toBe(true);
    expect(clean.evidenceCitations.some((c) => c.id === "ev-fabricated-999")).toBe(
      false,
    );
    expect(clean.answer).toContain("[ev-arr-cohort]");
    expect(clean.answer).not.toContain("ev-fabricated-999");
    expect(clean.confidence).toBeLessThanOrEqual(40);
  });

  it("askDoctor answers only cite snapshot evidence ids", async () => {
    const allowed = new Set(companySnapshot.evidence.map((e) => e.id));
    const questions = [
      "Why is governance only 71?",
      "Show evidence for customer concentration.",
      "What are the biggest risks?",
      "What should I fix before fundraising?",
    ];

    for (const question of questions) {
      const result = await askDoctor({ question });
      for (const c of result.answer.evidenceCitations) {
        expect(allowed.has(c.id)).toBe(true);
        expect(c.href).toBe(`/evidence?id=${encodeURIComponent(c.id)}`);
      }

      const mentioned = [
        ...result.answer.answer.matchAll(/\[(ev-[a-z0-9-]+)\]/gi),
      ].map((m) => m[1]!);
      for (const id of mentioned) {
        expect(allowed.has(id)).toBe(true);
      }
    }
  });
});

describe("end-to-end askDoctor", () => {
  it("returns structured schema fields for governance", async () => {
    const result = await askDoctor({
      question: "Why is governance only 71?",
    });

    expect(result.answer.answer.length).toBeGreaterThan(20);
    expect(result.answer.summary.length).toBeGreaterThan(0);
    expect(["high", "medium", "low"]).toContain(result.answer.riskLevel);
    expect(result.answer.confidence).toBeGreaterThan(40);
    expect(result.answer.evidenceCitations.length).toBeGreaterThan(0);
    expect(result.answer.relevantRisks.length).toBeGreaterThan(0);
    expect(Array.isArray(result.answer.recommendedActions)).toBe(true);
    expect(Array.isArray(result.answer.limitations)).toBe(true);
    expect(result.answer.insufficientEvidence).toBe(false);
  });

  it("uses injected LLM provider without changing pipeline", async () => {
    const stub: LLMProvider = {
      name: "stub",
      async generateDoctorAnswer(context: DoctorContext): Promise<DoctorAnswer> {
        const ev = context.evidence[0];
        return {
          answer: ev
            ? `Stub answer citing ${ev.id} [${ev.id}]`
            : "Stub with no evidence",
          summary: "stub",
          riskLevel: "low",
          confidence: ev ? 70 : 20,
          evidenceCitations: ev
            ? [
                {
                  id: ev.id,
                  label: `${ev.sourceSystem} · ${ev.title}`,
                  sourceSystem: ev.sourceSystem,
                  title: ev.title,
                  href: `/evidence?id=${ev.id}`,
                },
              ]
            : [],
          relevantFindings: [],
          relevantRisks: [],
          recommendedActions: [],
          limitations: ["stub"],
          insufficientEvidence: !ev,
        };
      },
    };

    const result = await askDoctor(
      { question: "Show evidence for customer concentration." },
      { llm: stub },
    );

    expect(result.answer.summary).toBe("stub");
    expect(result.answer.evidenceCitations[0]?.id).toBe("ev-arr-cohort");
  });

  it("mock provider never invents evidence outside context", async () => {
    const query = classifyQuery("Show evidence for customer concentration.");
    const retrieval = retrieveRelevantContext(companySnapshot, query);
    const context = buildDoctorContext(companySnapshot, query, retrieval);
    const allowed = new Set(context.evidence.map((e) => e.id));

    const answer = await createMockLLMProvider().generateDoctorAnswer(context);
    for (const c of answer.evidenceCitations) {
      expect(allowed.has(c.id)).toBe(true);
    }
  });
});
