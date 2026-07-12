import {
  getCompanyHealthSnapshot,
  getRiskById,
  listRegisteredCompanyIds,
} from "@/lib/data";
import { isDemoCompanyId } from "@/lib/dashboard/demo-mode";
import type { CompanyHealthSnapshot, Risk } from "@/lib/domain";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { createMockLLMProvider } from "@/lib/ai/mock-llm-provider";
import { buildDoctorContext, toEvidenceCitation } from "./context-builder";
import { classifyQuery } from "./query-classifier";
import { retrieveRelevantContext } from "./retriever";
import { doctorSuggestedPrompts } from "./prompts";
import type {
  DoctorAnswer,
  DoctorAskRequest,
  DoctorAskResponse,
  DoctorEvidenceCitation,
} from "./types";

function defaultCompanyId(): string {
  const ids = listRegisteredCompanyIds();
  if (ids.length === 0) {
    throw new Error("No companies registered for Company Doctor");
  }
  return ids[0]!;
}

let defaultProvider: LLMProvider | null = null;

export function getDefaultLLMProvider(): LLMProvider {
  if (!defaultProvider) {
    defaultProvider = createMockLLMProvider();
  }
  return defaultProvider;
}

/** Test / DI hook — swap provider without changing askDoctor. */
export function setDefaultLLMProvider(provider: LLMProvider): void {
  defaultProvider = provider;
}

/**
 * Ensure every citation id exists in the snapshot and every material
 * evidence id referenced in the answer text is present in citations.
 * Drops unknown citations; never invents new ones.
 */
export function enforceCitationIntegrity(
  answer: DoctorAnswer,
  allowedEvidenceIds: Set<string>,
  snapshotEvidence: DoctorEvidenceCitation[],
): DoctorAnswer {
  const validCitations = answer.evidenceCitations.filter((c) =>
    allowedEvidenceIds.has(c.id),
  );

  const mentioned = new Set<string>();
  const idPattern = /\[(ev-[a-z0-9-]+)\]/gi;
  let match: RegExpExecArray | null;
  const corpus = `${answer.answer}\n${answer.summary}`;
  while ((match = idPattern.exec(corpus)) !== null) {
    mentioned.add(match[1]!);
  }

  const citationIds = new Set(validCitations.map((c) => c.id));
  for (const id of mentioned) {
    if (!allowedEvidenceIds.has(id)) {
      continue;
    }
    if (!citationIds.has(id)) {
      const fromSnapshot = snapshotEvidence.find((e) => e.id === id);
      if (fromSnapshot) {
        validCitations.push(fromSnapshot);
        citationIds.add(id);
      }
    }
  }

  const fabricated = [...mentioned].filter((id) => !allowedEvidenceIds.has(id));
  let cleanedAnswer = answer.answer;
  let cleanedSummary = answer.summary;
  for (const id of fabricated) {
    cleanedAnswer = cleanedAnswer.replaceAll(`[${id}]`, "");
    cleanedSummary = cleanedSummary.replaceAll(`[${id}]`, "");
  }

  const limitations = [...answer.limitations];
  if (fabricated.length > 0) {
    limitations.push(
      "Removed unsupported evidence references that were not present in the snapshot.",
    );
  }

  const hasCitations = validCitations.length > 0;
  const insufficientEvidence =
    answer.insufficientEvidence || (!hasCitations && answer.confidence < 40);

  return {
    ...answer,
    answer: cleanedAnswer.replace(/\s{2,}/g, " ").trim(),
    summary: cleanedSummary.replace(/\s{2,}/g, " ").trim(),
    evidenceCitations: validCitations,
    limitations,
    confidence: fabricated.length > 0
      ? Math.min(answer.confidence, 40)
      : answer.confidence,
    insufficientEvidence,
  };
}

export interface AskDoctorOptions {
  llm?: LLMProvider;
  /**
   * Tenant / demo snapshot. Required for real company UUIDs.
   * When omitted, only registered demo companies (e.g. Acme) resolve.
   */
  snapshot?: CompanyHealthSnapshot;
}

function emptyAssessmentAnswer(companyName: string): DoctorAnswer {
  return {
    answer: `${companyName} does not have enough persisted health evidence yet. Upload and process documents, then ask again.`,
    summary: "No assessment available.",
    riskLevel: "low",
    confidence: 0,
    evidenceCitations: [],
    relevantFindings: [],
    relevantRisks: [],
    recommendedActions: [],
    limitations: [
      "Company Doctor uses your published assessment snapshot and evidence — none were available.",
    ],
    insufficientEvidence: true,
  };
}

function resolveSnapshot(
  companyId: string,
  options?: AskDoctorOptions,
): CompanyHealthSnapshot | null {
  if (options?.snapshot) return options.snapshot;

  const registered =
    isDemoCompanyId(companyId) ||
    listRegisteredCompanyIds().includes(companyId);
  if (!registered) return null;

  try {
    return getCompanyHealthSnapshot(companyId);
  } catch {
    return null;
  }
}

function resolveRisk(
  snapshot: CompanyHealthSnapshot,
  riskId: string,
): Risk | undefined {
  return (
    snapshot.risks.find((r) => r.id === riskId) ??
    (isDemoCompanyId(snapshot.company.id) ? getRiskById(riskId) : undefined)
  );
}

/**
 * Company Doctor pipeline:
 * question → classify → retrieve → context → LLM → citation-checked answer
 */
export async function askDoctor(
  request: DoctorAskRequest,
  options?: AskDoctorOptions,
): Promise<DoctorAskResponse> {
  const question = request.question?.trim() ?? "";
  if (!question) {
    const empty: DoctorAnswer = {
      answer: "Please ask a question about company health.",
      summary: "Empty question.",
      riskLevel: "low",
      confidence: 0,
      evidenceCitations: [],
      relevantFindings: [],
      relevantRisks: [],
      recommendedActions: [],
      limitations: ["No question provided."],
      insufficientEvidence: true,
    };
    return {
      answer: empty,
      classified: { intent: "unsupported", dimensionHints: [] },
    };
  }

  const companyId = request.companyId ?? defaultCompanyId();
  const snapshot = resolveSnapshot(companyId, options);

  if (!snapshot) {
    return {
      answer: emptyAssessmentAnswer("Your company"),
      classified: { intent: "general", dimensionHints: [] },
    };
  }

  const classified = classifyQuery(question);

  if (request.explainRiskId) {
    const risk = resolveRisk(snapshot, request.explainRiskId);
    if (risk) {
      classified.boostTerms = [
        ...classified.boostTerms,
        ...risk.title.toLowerCase().split(/\s+/),
        risk.dimension.toLowerCase(),
      ];
      if (!classified.dimensionHints.includes(risk.dimensionId)) {
        classified.dimensionHints.push(risk.dimensionId);
      }
      if (
        classified.intent === "general" ||
        classified.intent === "unsupported"
      ) {
        if (classified.intent === "unsupported") {
          classified.intent = "general";
        }
      }
    }
  }

  if (
    snapshot.evidence.length === 0 &&
    snapshot.findings.length === 0 &&
    snapshot.risks.length === 0 &&
    snapshot.healthScore.scoreAvailable === false
  ) {
    return {
      answer: emptyAssessmentAnswer(snapshot.company.name),
      classified: {
        intent: classified.intent,
        dimensionHints: classified.dimensionHints,
      },
    };
  }

  // Structured financial facts alone are enough to proceed (findings optional).
  const retrieval = retrieveRelevantContext(snapshot, classified, {
    explainRiskId: request.explainRiskId,
  });
  const context = buildDoctorContext(snapshot, classified, retrieval);
  const llm = options?.llm ?? getDefaultLLMProvider();
  const rawAnswer = await llm.generateDoctorAnswer(context);

  const allowedIds = new Set(snapshot.evidence.map((e) => e.id));
  const snapshotCitations = snapshot.evidence.map(toEvidenceCitation);
  const answer = enforceCitationIntegrity(
    rawAnswer,
    allowedIds,
    snapshotCitations,
  );

  return {
    answer,
    classified: {
      intent: classified.intent,
      dimensionHints: classified.dimensionHints,
    },
  };
}

/** Suggested prompts — prefer client-safe doctorSuggestedPrompts from ./prompts. */
export function getDoctorSuggestedPrompts(): string[] {
  try {
    const snapshot = getCompanyHealthSnapshot(defaultCompanyId());
    const governance = snapshot.dimensions.find((d) => d.id === "dim-governance");
    const governanceScore = governance?.score ?? 71;
    return [
      "What are the biggest risks?",
      `Why is governance only ${governanceScore}?`,
      "What should I fix before fundraising?",
      "Generate a board update.",
      "Show evidence for customer concentration.",
    ];
  } catch {
    return [...doctorSuggestedPrompts];
  }
}

export { doctorSuggestedPrompts };

export function getDoctorExplainPrompt(riskId: string): string {
  const risk = getRiskById(riskId);
  return risk?.explainPrompt ?? "Explain this risk";
}
