/**
 * Question coverage — answered / applicable / supported / lacking evidence.
 * Replaces document-count coverage as the diligence completeness signal.
 */

import type {
  DiligenceDimensionId,
  DiligenceQuestionAnswer,
  QuestionCoverageReport,
} from "@/lib/domain/diligence-question";
import { DILIGENCE_DIMENSION_IDS } from "@/lib/domain/diligence-question";

export function computeQuestionCoverage(input: {
  companyId: string;
  answers: DiligenceQuestionAnswer[];
  snapshotId?: string | null;
  generatedAt?: string;
}): QuestionCoverageReport {
  const applicableAnswers = input.answers.filter(
    (a) => a.stageLevel !== "not_applicable" && a.state !== "NOT_APPLICABLE",
  );
  const answered = applicableAnswers.filter(
    (a) =>
      a.state === "SUPPORTED" ||
      a.state === "CONTRADICTED" ||
      a.state === "INSUFFICIENT_EVIDENCE",
  );
  const supported = applicableAnswers.filter((a) => a.state === "SUPPORTED");
  const contradicted = applicableAnswers.filter(
    (a) => a.state === "CONTRADICTED",
  );
  const insufficient = applicableAnswers.filter(
    (a) => a.state === "INSUFFICIENT_EVIDENCE",
  );
  const unknown = applicableAnswers.filter((a) => a.state === "UNKNOWN");
  const notApplicable = input.answers.filter(
    (a) => a.state === "NOT_APPLICABLE" || a.stageLevel === "not_applicable",
  );
  const lackingEvidence = insufficient.length + unknown.length;

  const byDimension = {} as QuestionCoverageReport["byDimension"];
  for (const dim of DILIGENCE_DIMENSION_IDS) {
    const dimAnswers = applicableAnswers.filter((a) => {
      // dimension is on catalog; infer via question id prefix maps in answers only —
      // look up via questionId prefixes used in catalog.
      return questionDimension(a.questionId) === dim;
    });
    const dimSupported = dimAnswers.filter((a) => a.state === "SUPPORTED").length;
    const dimContradicted = dimAnswers.filter(
      (a) => a.state === "CONTRADICTED",
    ).length;
    const dimInsufficient = dimAnswers.filter(
      (a) => a.state === "INSUFFICIENT_EVIDENCE",
    ).length;
    byDimension[dim] = {
      applicable: dimAnswers.length,
      supported: dimSupported,
      contradicted: dimContradicted,
      insufficientEvidence: dimInsufficient,
      coverageRatio:
        dimAnswers.length === 0
          ? 0
          : Math.round(
              ((dimSupported + dimContradicted) / dimAnswers.length) * 1000,
            ) / 1000,
    };
  }

  const evidenceBackedAnswers = applicableAnswers.filter(
    (a) => a.state === "SUPPORTED" || a.state === "CONTRADICTED",
  );
  const meanConfidence =
    evidenceBackedAnswers.length > 0
      ? Math.round(
          evidenceBackedAnswers.reduce((s, a) => s + a.confidence, 0) /
            evidenceBackedAnswers.length,
        )
      : answered.length === 0
        ? 0
        : Math.round(
            answered.reduce((s, a) => s + a.confidence, 0) / answered.length,
          );

  const applicable = applicableAnswers.length;
  const coverageRatio =
    applicable === 0
      ? 0
      : Math.round(
          ((supported.length + contradicted.length) / applicable) * 1000,
        ) / 1000;

  return {
    companyId: input.companyId,
    snapshotId: input.snapshotId ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    applicable,
    answered: answered.length,
    supported: supported.length,
    contradicted: contradicted.length,
    insufficientEvidence: insufficient.length,
    notApplicable: notApplicable.length,
    unknown: unknown.length,
    lackingEvidence,
    coverageRatio,
    meanConfidence,
    byDimension,
  };
}

function questionDimension(questionId: string): DiligenceDimensionId {
  if (questionId.startsWith("q-fin-")) return "dim-financial";
  if (questionId.startsWith("q-gov-")) return "dim-governance";
  if (questionId.startsWith("q-legal-")) return "dim-legal";
  if (questionId.startsWith("q-cust-")) return "dim-customer";
  if (questionId.startsWith("q-sec-")) return "dim-security";
  if (questionId.startsWith("q-ops-")) return "dim-operations";
  if (questionId.startsWith("q-people-")) return "dim-people";
  return "dim-operations";
}
