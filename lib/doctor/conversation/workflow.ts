/**
 * Doctor workflow — Observe → Diagnose → Ask ONE → Request ONE → Recommend ONE.
 * Stage + assessment goal reweight investigations. Never asks for irrelevant docs.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type { CompanyHealthSnapshot } from "@/lib/domain";
import type {
  DoctorConversation,
  DoctorEvidenceRequest,
  DoctorHomeView,
  DoctorInvestigation,
  DoctorLearnedItem,
  DoctorNextAction,
} from "@/lib/domain/doctor-conversation";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import {
  collectPresentEvidenceTokens,
  evidenceRequestSatisfied,
} from "../evidence-aliases";
import {
  diagnoseFinancials,
  MIN_PRIMARY_INVESTIGATION_CONFIDENCE,
} from "../financial-diagnosis";
import {
  DOCTOR_INVESTIGATION_CATALOG,
  getInvestigationTemplate,
} from "../investigations/catalog";

function stageOk(
  stages: CompanyLifecycleStage[],
  stage: CompanyLifecycleStage | string | null | undefined,
): boolean {
  if (!stage) return true;
  return stages.includes(stage as CompanyLifecycleStage);
}

function presentEvidenceTypes(snapshot: CompanyHealthSnapshot): Set<string> {
  return collectPresentEvidenceTokens(snapshot);
}

function evidenceSatisfied(
  request: DoctorEvidenceRequest,
  present: Set<string>,
  evidence: CompanyHealthSnapshot["evidence"],
): boolean {
  return evidenceRequestSatisfied(request.evidenceTypes, present, evidence);
}

function seedConfidenceFromFacts(
  templateId: string,
  snapshot: CompanyHealthSnapshot,
): number {
  const diagnosis = diagnoseFinancials(snapshot);
  const issue = diagnosis.issues.find((i) => {
    if (templateId === "inv-runway-shortening") {
      return i.id.startsWith("fin-runway") || i.id === "fin-implied-runway";
    }
    if (templateId === "inv-revenue-slowing") {
      return i.id === "fin-revenue-decline";
    }
    if (templateId === "inv-customer-concentration") {
      return i.id === "fin-concentration";
    }
    if (templateId === "inv-cash-declining") {
      return i.factKeys.includes("cashBalance") || i.factKeys.includes("burnRateMonthly");
    }
    return false;
  });
  if (issue) return issue.confidence;
  // Facts present for this theme but no material issue — low hypothesis only.
  if (diagnosis.facts.length > 0) return 20;
  return 15;
}

function scoreTemplate(
  templateId: string,
  goal: AssessmentGoalId,
  stage: CompanyLifecycleStage | string | null,
  snapshot: CompanyHealthSnapshot,
  completedIds: Set<string>,
): number {
  const template = getInvestigationTemplate(templateId);
  if (!template) return -1;
  if (completedIds.has(template.id)) return -1;
  if (!stageOk(template.applicableStages, stage)) return -1;

  const goalW = template.goalWeights[goal] ?? 1;
  let signal = 0;
  const hay = [
    ...snapshot.risks.map((r) => `${r.title} ${r.summary}`),
    ...snapshot.findings.map((f) => `${f.title} ${f.summary}`),
  ]
    .join(" ")
    .toLowerCase();
  for (const kw of template.signalKeywords) {
    if (hay.includes(kw.toLowerCase())) signal += 8;
  }

  // Prefer gaps: if required evidence missing, boost priority.
  const present = presentEvidenceTypes(snapshot);
  const missing = template.requiredEvidence.some(
    (r) => !evidenceSatisfied(r, present, snapshot.evidence),
  );
  const gapBoost = missing ? 12 : -5;

  // When financial facts show no material issue for this theme, demote hard
  // so Doctor does not manufacture a primary investigation.
  const diagnosis = diagnoseFinancials(snapshot);
  let factAdjust = 0;
  if (diagnosis.facts.length > 0) {
    const relatedIssue = diagnosis.issues.find((i) => {
      if (template.id === "inv-runway-shortening") {
        return i.id.startsWith("fin-runway") || i.id === "fin-implied-runway";
      }
      if (template.id === "inv-revenue-slowing") {
        return i.id === "fin-revenue-decline";
      }
      if (template.id === "inv-customer-concentration") {
        return i.id === "fin-concentration";
      }
      return false;
    });
    if (relatedIssue) {
      factAdjust = relatedIssue.confidence >= 70 ? 25 : 10;
    } else if (
      template.id === "inv-runway-shortening" ||
      template.id === "inv-revenue-slowing" ||
      template.id === "inv-cash-declining"
    ) {
      // Facts already cover this theme with no material problem — do not open.
      return -1;
    }
  }

  return template.basePriority * goalW + signal + gapBoost + factAdjust;
}

export function selectNextInvestigationTemplate(input: {
  goal: AssessmentGoalId;
  stage: CompanyLifecycleStage | string | null;
  snapshot: CompanyHealthSnapshot;
  completedTemplateIds: string[];
}): (typeof DOCTOR_INVESTIGATION_CATALOG)[number] | null {
  const completed = new Set(input.completedTemplateIds);
  let best: (typeof DOCTOR_INVESTIGATION_CATALOG)[number] | null = null;
  let bestScore = -1;
  for (const template of DOCTOR_INVESTIGATION_CATALOG) {
    const score = scoreTemplate(
      template.id,
      input.goal,
      input.stage,
      input.snapshot,
      completed,
    );
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return bestScore > 0 ? best : null;
}

export function buildTopObservation(
  snapshot: CompanyHealthSnapshot,
  goal: AssessmentGoalId,
): string {
  const diagnosis = diagnoseFinancials(snapshot);
  const topRisk = [...snapshot.risks].sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 } as const;
    return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0);
  })[0];

  const scoreLine =
    snapshot.healthScore.scoreAvailable === false
      ? "I do not yet have enough scored dimensions for a full health number."
      : `Overall health is ${snapshot.healthScore.score} (${snapshot.healthScore.status}).`;

  if (diagnosis.primaryIssue) {
    return `${scoreLine} ${diagnosis.primaryIssue.summary}`;
  }

  if (diagnosis.facts.length > 0 && diagnosis.noMaterialIssue) {
    const uncertainty = diagnosis.unknowns[0] ?? "forecast vs actual tracking";
    return `${scoreLine} I reviewed the available financial data and did not identify a high-confidence critical issue. Next largest uncertainty: ${uncertainty}.`;
  }

  if (topRisk && (topRisk.confidence ?? 50) >= MIN_PRIMARY_INVESTIGATION_CONFIDENCE) {
    return `${scoreLine} Strongest signal: ${topRisk.title} — ${topRisk.summary || topRisk.whyItMatters}`;
  }

  if (snapshot.evidence.length > 0) {
    return `${scoreLine} I reviewed ${snapshot.evidence.length} evidence items for the ${goal.replace(/-/g, " ")} mode and can start a focused investigation.`;
  }

  return `${scoreLine} I can still help: tell me the single biggest worry on your mind, or upload one cash or customer snapshot so I can ground the next recommendation.`;
}

export function advanceInvestigation(input: {
  investigation: DoctorInvestigation;
  snapshot: CompanyHealthSnapshot;
}): {
  investigation: DoctorInvestigation;
  learned: DoctorLearnedItem[];
  phase: DoctorHomeView["workflowPhase"];
  mentorMessage: string;
  requestedEvidence: DoctorEvidenceRequest[];
  nextAction: DoctorNextAction | null;
} {
  const present = presentEvidenceTypes(input.snapshot);
  const inv = { ...input.investigation };
  const learned: DoctorLearnedItem[] = [];
  const now = new Date().toISOString();

  if (inv.confidence < MIN_PRIMARY_INVESTIGATION_CONFIDENCE) {
    inv.confidence = Math.max(
      inv.confidence,
      seedConfidenceFromFacts(inv.templateId, input.snapshot),
    );
  }

  const frameHypothesis = (text: string) =>
    inv.confidence < MIN_PRIMARY_INVESTIGATION_CONFIDENCE
      ? `Possible issue to investigate: ${text}`
      : text;

  // If requested evidence arrived, learn and advance to recommend.
  if (
    inv.evidenceRequest &&
    evidenceSatisfied(
      inv.evidenceRequest,
      present,
      input.snapshot.evidence,
    )
  ) {
    learned.push({
      id: `learn-${inv.id}-${Date.now()}`,
      text: `Received ${inv.evidenceRequest.label} — ${inv.evidenceRequest.expectedInsight}`,
      learnedAt: now,
      investigationId: inv.id,
      evidenceTypes: inv.evidenceRequest.evidenceTypes,
    });
    inv.confidence = Math.min(100, inv.confidence + 25);
    inv.status = "recommended";
    inv.recommendation = {
      ...inv.recommendation!,
      evidenceIds: input.snapshot.evidence
        .filter((e) =>
          evidenceRequestSatisfied(
            inv.evidenceRequest!.evidenceTypes,
            collectPresentEvidenceTokens({ evidence: [e] }),
            [e],
          ),
        )
        .map((e) => e.id)
        .slice(0, 5),
      findingIds: input.snapshot.findings.slice(0, 3).map((f) => f.id),
      questionIds: [],
      documentIds: [],
    };
    inv.explainability = {
      recommendationId: inv.recommendation.id,
      findingIds: inv.recommendation.findingIds ?? [],
      questionIds: [],
      evidenceIds: inv.recommendation.evidenceIds ?? [],
      documentIds: [],
    };
    inv.evidenceRequest = null;
    inv.blockingUnknowns = [];
    return {
      investigation: inv,
      learned,
      phase: "recommend",
      mentorMessage: [
        learned[0]!.text,
        `Next action: ${inv.recommendation.title}.`,
        inv.recommendation.description,
      ].join(" "),
      requestedEvidence: [],
      nextAction: inv.recommendation,
    };
  }

  // Prefer a single high-value question before evidence if still early.
  if (inv.status === "open") {
    if (!inv.currentQuestion) {
      const template = getInvestigationTemplate(inv.templateId);
      inv.currentQuestion =
        template?.highValueQuestion ?? inv.businessQuestion;
    }
    inv.status = "asking";
    return {
      investigation: inv,
      learned,
      phase: "ask",
      mentorMessage: [
        frameHypothesis(inv.title),
        `Hypothesis: ${inv.hypotheses[0] ?? "needs validation"} (confidence ${Math.round(inv.confidence)}%).`,
        `One question: ${inv.currentQuestion}`,
      ].join(" "),
      requestedEvidence: [],
      nextAction: null,
    };
  }

  // After the question is posed, request exactly one evidence item (if needed).
  const template = getInvestigationTemplate(inv.templateId);
  const nextReq =
    template?.requiredEvidence.find(
      (r) => !evidenceSatisfied(r, present, input.snapshot.evidence),
    ) ?? null;

  if (nextReq) {
    inv.status = "awaiting_evidence";
    inv.evidenceRequest = nextReq;
    inv.blockingUnknowns = [
      `Need ${nextReq.label} to raise confidence on: ${inv.businessQuestion}`,
    ];
    const connect = nextReq.connectAlternative
      ? ` OR ${nextReq.connectAlternative}`
      : "";
    return {
      investigation: inv,
      learned,
      phase: "request_evidence",
      mentorMessage: [
        frameHypothesis(inv.hypotheses[0] ?? "this risk may be material"),
        `Can you upload ${nextReq.label}${connect}?`,
        `Why: ${nextReq.why}`,
        `Expected insight: ${nextReq.expectedInsight}`,
        `Estimated effort: ${nextReq.estimatedEffort}.`,
      ].join(" "),
      requestedEvidence: [nextReq],
      nextAction: null,
    };
  }

  // Enough evidence already — recommend.
  inv.status = "recommended";
  inv.confidence = Math.max(inv.confidence, 55);
  inv.recommendation = inv.recommendation ?? {
    id: `rec-${inv.templateId}`,
    title: inv.title,
    description: inv.businessQuestion,
    rationale: "Based on available evidence in the current snapshot.",
  };
  return {
    investigation: inv,
    learned,
    phase: "recommend",
    mentorMessage: [
      `Based on what I already have, the highest-leverage action is: ${inv.recommendation.title}.`,
      inv.recommendation.description,
      "I am not asking for more documents until that action is underway.",
    ].join(" "),
    requestedEvidence: [],
    nextAction: inv.recommendation,
  };
}

export function buildDoctorHomeView(input: {
  conversation: DoctorConversation;
  currentInvestigation: DoctorInvestigation | null;
  completedInvestigations: DoctorInvestigation[];
  snapshot: CompanyHealthSnapshot;
  mentorMessage: string;
  phase: DoctorHomeView["workflowPhase"];
  requestedEvidence: DoctorEvidenceRequest[];
  nextAction: DoctorNextAction | null;
}): DoctorHomeView {
  const goal =
    (input.conversation.assessmentGoal as AssessmentGoalId) ||
    DEFAULT_ASSESSMENT_GOAL;
  const topObservation =
    input.conversation.topObservation ||
    buildTopObservation(input.snapshot, goal);

  return {
    conversation: input.conversation,
    currentInvestigation: input.currentInvestigation,
    topObservation,
    currentConfidence: input.conversation.confidence,
    nextRecommendedAction:
      input.nextAction ?? input.conversation.nextAction,
    requestedEvidence: input.requestedEvidence,
    recentlyLearned: input.conversation.recentlyLearned.slice(0, 8),
    completedInvestigations: input.completedInvestigations,
    workflowPhase: input.phase,
    mentorMessage: input.mentorMessage,
    provenance: {
      companyId: input.conversation.companyId,
      snapshotId: input.conversation.snapshotId,
      assessmentGoal: input.conversation.assessmentGoal,
      companyStage: input.conversation.companyStage,
      generatedAt: new Date().toISOString(),
    },
  };
}
