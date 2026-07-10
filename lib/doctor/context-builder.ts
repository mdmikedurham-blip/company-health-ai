import type { CompanyHealthSnapshot } from "@/lib/domain";
import { formatEvidenceLabel } from "@/lib/domain";
import type {
  ClassifiedQuery,
  DoctorContext,
  DoctorEvidenceCitation,
  RetrievalResult,
} from "./types";

export function evidenceHref(evidenceId: string): string {
  return `/evidence?id=${encodeURIComponent(evidenceId)}`;
}

export function toEvidenceCitation(
  evidence: CompanyHealthSnapshot["evidence"][number],
): DoctorEvidenceCitation {
  return {
    id: evidence.id,
    label: formatEvidenceLabel(evidence),
    sourceSystem: evidence.sourceSystem,
    title: evidence.title,
    href: evidenceHref(evidence.id),
  };
}

/**
 * Build a compact, citation-ready context pack for the LLM.
 * Only includes retrieved entities — never the full snapshot.
 */
export function buildDoctorContext(
  snapshot: CompanyHealthSnapshot,
  query: ClassifiedQuery,
  retrieval: RetrievalResult,
): DoctorContext {
  return {
    question: query.question,
    intent: query.intent,
    companyName: snapshot.company.name,
    healthScore: {
      score: snapshot.healthScore.score,
      status: snapshot.healthScore.status,
      changeLabel: snapshot.healthScore.changeLabel,
      confidence: snapshot.healthScore.confidence,
    },
    evidence: retrieval.evidence.map(({ item }) => ({
      id: item.id,
      sourceSystem: item.sourceSystem,
      title: item.title,
      contentSummary: item.contentSummary,
      dimension: item.dimension,
      reliability: item.reliability,
      extractedFacts: item.extractedFacts,
    })),
    findings: retrieval.findings.map(({ item }) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      dimension: item.dimension,
      direction: item.direction,
      materiality: item.materiality,
      confidence: item.confidence,
      evidenceIds: item.evidenceIds,
    })),
    risks: retrieval.risks.map(({ item }) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      severity: item.severity,
      dimension: item.dimension,
      whyItMatters: item.whyItMatters,
      recommendation: item.recommendation,
      evidenceIds: item.evidenceIds,
      confidence: item.confidence,
    })),
    recommendations: retrieval.recommendations.map(({ item }) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      priority: item.priority,
      evidenceIds: item.evidenceIds,
      nextSteps: item.nextSteps,
    })),
    dimensions: retrieval.dimensions.map(({ item }) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      status: item.status,
      summary: item.summary,
      evidenceIds: item.evidenceIds,
    })),
    timeline: retrieval.timeline.map(({ item }) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      description: item.description,
      type: item.type,
    })),
    insufficientEvidence:
      retrieval.insufficientEvidence || query.intent === "unsupported",
  };
}
