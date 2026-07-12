import type { RiskSeverity, Evidence } from "@/lib/domain";
import type { LLMProvider } from "./llm-provider";
import type {
  DoctorActionRef,
  DoctorAnswer,
  DoctorContext,
  DoctorEvidenceCitation,
  DoctorFindingRef,
  DoctorRiskRef,
} from "@/lib/doctor/types";
import {
  composeFinancialAnswer,
  diagnoseFinancials,
} from "@/lib/doctor/financial-diagnosis";

function cite(id: string): string {
  return `[${id}]`;
}

function citationsFromContext(context: DoctorContext): DoctorEvidenceCitation[] {
  return context.evidence.map((e) => ({
    id: e.id,
    label: `${e.sourceSystem} · ${e.title}`,
    sourceSystem: e.sourceSystem,
    title: e.title,
    href: `/evidence?id=${encodeURIComponent(e.id)}`,
  }));
}

function findingRefs(context: DoctorContext): DoctorFindingRef[] {
  return context.findings.map((f) => ({
    id: f.id,
    title: f.title,
    dimension: f.dimension,
  }));
}

function riskRefs(context: DoctorContext): DoctorRiskRef[] {
  return context.risks.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    dimension: r.dimension,
  }));
}

function actionRefs(context: DoctorContext): DoctorActionRef[] {
  return context.recommendations.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
  }));
}

function highestRiskLevel(context: DoctorContext): RiskSeverity {
  const order: RiskSeverity[] = ["high", "medium", "low"];
  let best: RiskSeverity = "low";
  for (const risk of context.risks) {
    if (order.indexOf(risk.severity) < order.indexOf(best)) {
      best = risk.severity;
    }
  }
  if (context.risks.length === 0 && context.dimensions.some((d) => d.status === "at-risk")) {
    return "medium";
  }
  return best;
}

function collectEvidenceIds(context: DoctorContext): string[] {
  const ids = new Set<string>();
  for (const e of context.evidence) ids.add(e.id);
  for (const f of context.findings) f.evidenceIds.forEach((id) => ids.add(id));
  for (const r of context.risks) r.evidenceIds.forEach((id) => ids.add(id));
  for (const rec of context.recommendations) {
    rec.evidenceIds.forEach((id) => ids.add(id));
  }
  for (const d of context.dimensions) d.evidenceIds.forEach((id) => ids.add(id));
  for (const f of context.structuredFacts ?? []) ids.add(f.evidenceId);
  return [...ids];
}

function citationsForIds(
  context: DoctorContext,
  evidenceIds: string[],
): DoctorEvidenceCitation[] {
  const wanted = new Set(evidenceIds);
  const fromEvidence = citationsFromContext(context).filter((c) =>
    wanted.has(c.id),
  );
  if (fromEvidence.length > 0) return fromEvidence;
  return (context.structuredFacts ?? [])
    .filter((f) => wanted.has(f.evidenceId))
    .map((f) => ({
      id: f.evidenceId,
      label: f.evidenceTitle,
      sourceSystem: "Manual Upload",
      title: f.evidenceTitle,
      href: `/evidence?id=${encodeURIComponent(f.evidenceId)}`,
    }));
}

function evidenceRowsFromContext(context: DoctorContext): Evidence[] {
  if (context.evidence.length > 0) {
    return context.evidence.map((e) => ({
      id: e.id,
      sourceSystem: e.sourceSystem,
      sourceType: "financial",
      title: e.title,
      contentSummary: e.contentSummary,
      extractedFacts: e.extractedFacts,
      dimensionIds: ["dim-financial"],
      dimensionId: "dim-financial",
      dimension: e.dimension,
      occurredAt: "",
      collectedAt: "",
      reliability: e.reliability,
      metadata: { evidenceType: "financial" },
      citation: { label: e.title },
      findingIds: [],
      linkedRiskIds: [],
    }));
  }

  const byId = new Map<string, Evidence>();
  for (const f of context.structuredFacts ?? []) {
    const existing = byId.get(f.evidenceId);
    const facts = {
      ...(existing?.extractedFacts ?? {}),
      [f.key]: f.value,
      ...(f.worksheet ? { [`${f.key}Worksheet`]: f.worksheet } : {}),
      ...(f.period ? { [`${f.key}Period`]: f.period } : {}),
    };
    byId.set(f.evidenceId, {
      id: f.evidenceId,
      sourceSystem: "Manual Upload",
      sourceType: "financial",
      title: f.evidenceTitle,
      contentSummary: "Structured financial workbook facts",
      extractedFacts: facts,
      dimensionIds: ["dim-financial"],
      dimensionId: "dim-financial",
      dimension: "Financial",
      occurredAt: "",
      collectedAt: "",
      reliability: 85,
      metadata: { evidenceType: "financial" },
      citation: { label: f.evidenceTitle },
      findingIds: [],
      linkedRiskIds: [],
    });
  }
  return [...byId.values()];
}

function answerFromStructuredFacts(context: DoctorContext): DoctorAnswer | null {
  const evidence = evidenceRowsFromContext(context);
  if (evidence.length === 0) return null;

  const diagnosis = diagnoseFinancials(
    { evidence, assessmentSnapshotId: context.snapshotId },
    { snapshotId: context.snapshotId },
  );

  if (diagnosis.facts.length === 0) return null;

  const composed = composeFinancialAnswer({
    companyName: context.companyName,
    question: context.question,
    diagnosis,
    preferRiskFraming: true,
  });

  return {
    answer: composed.answer,
    summary: composed.summary,
    riskLevel: composed.riskLevel,
    confidence: composed.confidence,
    evidenceCitations: citationsForIds(context, composed.evidenceIds),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: composed.nextAction
      ? [
          {
            id: "fin-next",
            title: composed.nextAction,
            priority: "high",
          },
        ]
      : actionRefs(context),
    limitations: [
      "Answer grounded in structured financial facts from the current published snapshot.",
    ],
    insufficientEvidence: composed.insufficientEvidence,
  };
}

function insufficientAnswer(context: DoctorContext, reason: string): DoctorAnswer {
  return {
    answer: reason,
    summary:
      "Insufficient evidence in the current Insight Engine snapshot to answer this question with citations.",
    riskLevel: "low",
    confidence: 15,
    evidenceCitations: [],
    relevantFindings: [],
    relevantRisks: [],
    recommendedActions: [],
    limitations: [
      "No relevant evidence, findings, risks, or structured financial facts were retrieved for this question.",
      "Company Doctor only answers from connected company systems — it will not invent sources.",
    ],
    insufficientEvidence: true,
  };
}

function answerUnsupported(context: DoctorContext): DoctorAnswer {
  return insufficientAnswer(
    context,
    `I can only answer questions about ${context.companyName}'s company health using connected evidence (risks, dimensions, documents, and recommendations). This question is outside that scope.`,
  );
}

function answerGovernance(context: DoctorContext): DoctorAnswer {
  const dim = context.dimensions.find((d) => d.id === "dim-governance" || d.name === "Governance");
  const risk =
    context.risks.find((r) => r.id === "risk-board-approval") ?? context.risks[0];
  const evidence =
    context.evidence.find((e) => e.id === "ev-equity-grants") ?? context.evidence[0];
  const rec =
    context.recommendations.find((r) => r.id === "rec-board-consents") ??
    context.recommendations[0];

  if (!evidence && !risk && !dim) {
    return insufficientAnswer(
      context,
      "I could not find governance evidence or risks in the current snapshot.",
    );
  }

  const scorePart = dim
    ? `Governance scores ${dim.score} (${dim.status}).`
    : "Governance is under review.";
  const riskPart = risk
    ? ` ${risk.summary} ${cite(risk.evidenceIds[0] ?? evidence?.id ?? "")}`
    : "";
  const evidencePart = evidence
    ? ` Supporting document: ${evidence.title} ${cite(evidence.id)} — ${evidence.contentSummary}`
    : "";
  const actionPart = rec
    ? ` Recommended action: ${rec.title}.`
    : "";

  const answer = `${scorePart}${riskPart}${evidencePart}${actionPart}`.trim();

  return {
    answer,
    summary: dim?.summary ?? risk?.summary ?? "Governance requires attention based on retrieved evidence.",
    riskLevel: risk?.severity ?? "medium",
    confidence: Math.min(
      92,
      Math.round(
        ((evidence?.reliability ?? 70) + (risk?.confidence ?? 70) + (dim?.score ? 80 : 50)) / 3,
      ),
    ),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Assessment limited to retrieved governance evidence and linked risks.",
    ],
    insufficientEvidence: false,
  };
}

function answerConcentration(context: DoctorContext): DoctorAnswer {
  const risk =
    context.risks.find((r) => r.id === "risk-concentration") ?? context.risks[0];
  const evidence =
    context.evidence.find((e) => e.id === "ev-arr-cohort") ?? context.evidence[0];
  const finding =
    context.findings.find((f) => f.id === "finding-concentration") ??
    context.findings[0];
  const rec =
    context.recommendations.find((r) => r.id === "rec-diversify-customers") ??
    context.recommendations[0];

  if (!evidence && !risk) {
    return insufficientAnswer(
      context,
      "I could not find customer concentration evidence in the current snapshot.",
    );
  }

  const parts: string[] = [];
  if (risk) {
    parts.push(`${risk.title}: ${risk.summary} ${cite(risk.evidenceIds[0] ?? evidence!.id)}`);
    parts.push(risk.whyItMatters);
  }
  if (evidence) {
    parts.push(`Evidence: ${evidence.contentSummary} ${cite(evidence.id)}`);
  }
  if (finding) {
    parts.push(`Finding: ${finding.title} ${cite(finding.evidenceIds[0] ?? evidence?.id ?? "")}`);
  }
  if (rec) {
    parts.push(`Recommended action: ${rec.title} — ${rec.description}`);
  }

  return {
    answer: parts.join(" "),
    summary: risk?.summary ?? evidence?.contentSummary ?? "Customer concentration risk identified.",
    riskLevel: risk?.severity ?? "high",
    confidence: Math.min(95, Math.round((evidence?.reliability ?? 80) * 0.95)),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Concentration figures come only from retrieved ARR / customer evidence.",
    ],
    insufficientEvidence: false,
  };
}

function answerRisks(context: DoctorContext): DoctorAnswer {
  if (context.risks.length === 0) {
    const fromFacts = answerFromStructuredFacts(context);
    if (fromFacts) return fromFacts;
    return insufficientAnswer(
      context,
      "No risks were retrieved from the current Insight Engine snapshot.",
    );
  }

  const lines = context.risks.map((r) => {
    const ev = r.evidenceIds[0] ? cite(r.evidenceIds[0]) : "";
    return `${r.title} (${r.severity}): ${r.summary} ${ev}`.trim();
  });

  const top = context.risks[0]!;
  const actions =
    context.recommendations.length > 0
      ? ` Priority actions: ${context.recommendations.map((r) => r.title).join("; ")}.`
      : "";

  return {
    answer: `${context.companyName} has ${context.risks.length} relevant risk(s). ${lines.join(" ")}${actions}`,
    summary: `${top.title} is the highest-priority retrieved risk (${top.severity}).`,
    riskLevel: highestRiskLevel(context),
    confidence: Math.min(
      90,
      Math.round(
        context.risks.reduce((s, r) => s + r.confidence, 0) / context.risks.length,
      ),
    ),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Only risks ranked relevant to this question are included.",
    ],
    insufficientEvidence: false,
  };
}

function answerFinancial(context: DoctorContext): DoctorAnswer {
  const fromFacts = answerFromStructuredFacts(context);
  if (fromFacts) return fromFacts;
  if (context.evidence.length > 0) return answerEvidence(context);
  return insufficientAnswer(
    context,
    "I could not find structured financial facts in the current snapshot.",
  );
}

function answerFundraising(context: DoctorContext): DoctorAnswer {
  if (context.risks.length === 0 && context.evidence.length === 0) {
    return insufficientAnswer(
      context,
      "Insufficient evidence to advise on fundraising readiness.",
    );
  }

  const riskLines = context.risks.map((r) => {
    const ev = r.evidenceIds[0] ? cite(r.evidenceIds[0]) : "";
    return `${r.title} (${r.severity}) ${ev}`.trim();
  });
  const actions = context.recommendations.map((r) => r.title);

  return {
    answer: `Before fundraising, address these evidence-backed issues: ${riskLines.join("; ")}. ${
      actions.length > 0 ? `Fix first: ${actions.join("; ")}.` : ""
    } Overall health is ${context.healthScore.score} (${context.healthScore.status}, ${context.healthScore.changeLabel}).`.trim(),
    summary: `Fundraising readiness is constrained by ${context.risks.length} retrieved risk(s).`,
    riskLevel: highestRiskLevel(context),
    confidence: Math.min(88, context.healthScore.confidence),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Fundraising advice is limited to risks and evidence in the current snapshot.",
    ],
    insufficientEvidence: false,
  };
}

function answerBoardUpdate(context: DoctorContext): DoctorAnswer {
  const riskBits = context.risks
    .slice(0, 4)
    .map((r) => `${r.title} ${r.evidenceIds[0] ? cite(r.evidenceIds[0]) : ""}`.trim());
  const dimBits = context.dimensions
    .slice(0, 3)
    .map((d) => `${d.name} ${d.score}`);

  return {
    answer: `Board update draft for ${context.companyName}: health score ${context.healthScore.score} (${context.healthScore.status}, ${context.healthScore.changeLabel}, confidence ${context.healthScore.confidence}%). Key dimensions: ${dimBits.join(", ") || "n/a"}. Key risks: ${riskBits.join("; ") || "none retrieved"}.`,
    summary: `Health ${context.healthScore.score} with ${context.risks.length} cited risk(s).`,
    riskLevel: highestRiskLevel(context),
    confidence: Math.min(90, context.healthScore.confidence),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Draft only — verify figures against source systems before distributing.",
    ],
    insufficientEvidence: context.evidence.length === 0 && context.risks.length === 0,
  };
}

function answerHealth(context: DoctorContext): DoctorAnswer {
  const dimLines = context.dimensions.map((d) => {
    const ev = d.evidenceIds[0] ? cite(d.evidenceIds[0]) : "";
    return `${d.name} is ${d.score} (${d.status}) ${ev} — ${d.summary}`.trim();
  });

  return {
    answer: `${context.companyName} health score is ${context.healthScore.score} (${context.healthScore.status}, ${context.healthScore.changeLabel}, confidence ${context.healthScore.confidence}%). ${dimLines.join(" ")}`,
    summary: `Overall health ${context.healthScore.score} (${context.healthScore.status}).`,
    riskLevel: highestRiskLevel(context),
    confidence: context.healthScore.confidence,
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Dimension commentary limited to retrieved dimensions and their linked evidence.",
    ],
    insufficientEvidence: false,
  };
}

function answerRecommendations(context: DoctorContext): DoctorAnswer {
  if (context.recommendations.length === 0) {
    return insufficientAnswer(
      context,
      "No recommendations were retrieved for this question.",
    );
  }

  const lines = context.recommendations.map((r) => {
    const ev = r.evidenceIds[0] ? cite(r.evidenceIds[0]) : "";
    return `${r.title} (${r.priority}): ${r.description} ${ev}`.trim();
  });

  return {
    answer: `Recommended next actions: ${lines.join(" ")}`,
    summary: context.recommendations[0]!.title,
    riskLevel: highestRiskLevel(context),
    confidence: 80,
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: [
      "Actions are ranked from the Insight Engine recommendation set for this query.",
    ],
    insufficientEvidence: false,
  };
}

function answerEvidence(context: DoctorContext): DoctorAnswer {
  if (context.evidence.length === 0) {
    return insufficientAnswer(
      context,
      "No matching evidence documents were retrieved.",
    );
  }

  const lines = context.evidence.map(
    (e) => `${e.title} ${cite(e.id)} (${e.sourceSystem}): ${e.contentSummary}`,
  );

  return {
    answer: `Relevant evidence: ${lines.join(" ")}`,
    summary: `Found ${context.evidence.length} evidence document(s).`,
    riskLevel: highestRiskLevel(context),
    confidence: Math.min(
      95,
      Math.round(
        context.evidence.reduce((s, e) => s + e.reliability, 0) /
          context.evidence.length,
      ),
    ),
    evidenceCitations: citationsFromContext(context),
    relevantFindings: findingRefs(context),
    relevantRisks: riskRefs(context),
    recommendedActions: actionRefs(context),
    limitations: ["Only documents ranked relevant to the question are listed."],
    insufficientEvidence: false,
  };
}

function answerGeneral(context: DoctorContext): DoctorAnswer {
  const financialCue =
    /\b(runway|burn|cash|revenue|margin|ebitda|financial|growth|churn)\b/i.test(
      context.question,
    ) || context.structuredFacts.length > 0 &&
      context.intent === "financial";

  if (financialCue && context.structuredFacts.length > 0) {
    const fromFacts = answerFromStructuredFacts(context);
    if (fromFacts) return fromFacts;
  }

  if (context.insufficientEvidence || collectEvidenceIds(context).length === 0) {
    return insufficientAnswer(
      context,
      `I reviewed ${context.companyName}'s Insight Engine snapshot but could not find enough relevant evidence to answer confidently. Try asking about a specific risk, dimension (e.g. governance), or document.`,
    );
  }

  // Prefer risk-centric general answers when risks retrieved
  if (context.risks.length > 0) {
    return answerRisks(context);
  }
  if (context.dimensions.length > 0) {
    return answerHealth(context);
  }
  return answerEvidence(context);
}

/**
 * Deterministic local LLM stand-in.
 * Composes structured answers strictly from DoctorContext — never fabricates evidence IDs.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async generateDoctorAnswer(context: DoctorContext): Promise<DoctorAnswer> {
    if (context.intent === "unsupported") {
      return answerUnsupported(context);
    }

    // Structured financial facts can answer financial/risk questions even when
    // keyword retrieval is thin — not for unrelated general questions.
    if (
      context.insufficientEvidence &&
      (context.structuredFacts?.length ?? 0) > 0 &&
      (context.intent === "financial" ||
        context.intent === "risks" ||
        context.intent === "fundraising" ||
        context.intent === "recommendations")
    ) {
      const fromFacts = answerFromStructuredFacts(context);
      if (fromFacts) return fromFacts;
    }

    if (context.insufficientEvidence) {
      return insufficientAnswer(
        context,
        `I do not have enough relevant evidence in the current snapshot to answer: "${context.question}".`,
      );
    }

    switch (context.intent) {
      case "governance":
        return answerGovernance(context);
      case "customer_concentration":
        return answerConcentration(context);
      case "risks":
        return answerRisks(context);
      case "financial":
        return answerFinancial(context);
      case "fundraising":
        return answerFundraising(context);
      case "board_update":
        return answerBoardUpdate(context);
      case "health":
        return answerHealth(context);
      case "recommendations":
        return answerRecommendations(context);
      case "evidence":
        return answerEvidence(context);
      case "general":
      default:
        return answerGeneral(context);
    }
  }
}

export function createMockLLMProvider(): LLMProvider {
  return new MockLLMProvider();
}
