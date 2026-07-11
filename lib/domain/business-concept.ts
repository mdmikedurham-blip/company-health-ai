/**
 * Business Concept domain — Phase 5 knowledge model.
 * Concepts sit between Evidence and Diligence Questions.
 */

import type { CompanyId, EvidenceId } from "./primitives";

export type BusinessConceptId =
  | "financial-performance"
  | "cash-management"
  | "revenue-quality"
  | "customer-concentration"
  | "recurring-revenue"
  | "governance"
  | "board-oversight"
  | "corporate-approvals"
  | "capital-structure"
  | "equity-management"
  | "legal-structure"
  | "intellectual-property"
  | "employment"
  | "compliance"
  | "security-program"
  | "operational-excellence"
  | "people"
  | "leadership"
  | "sales-execution"
  | "product-execution"
  | "strategic-planning"
  | "risk-management";

export const BUSINESS_CONCEPT_IDS: BusinessConceptId[] = [
  "financial-performance",
  "cash-management",
  "revenue-quality",
  "customer-concentration",
  "recurring-revenue",
  "governance",
  "board-oversight",
  "corporate-approvals",
  "capital-structure",
  "equity-management",
  "legal-structure",
  "intellectual-property",
  "employment",
  "compliance",
  "security-program",
  "operational-excellence",
  "people",
  "leadership",
  "sales-execution",
  "product-execution",
  "strategic-planning",
  "risk-management",
];

export type BusinessConceptState =
  | "supported"
  | "contradicted"
  | "partial"
  | "unknown"
  | "not_applicable";

export type BusinessConceptDefinition = {
  id: BusinessConceptId;
  label: string;
  description: string;
  /** Fact keys that feed this concept (aliases allowed). */
  factKeys: string[];
  /** Fact keys whose presence/value indicates contradiction when unhealthy. */
  contradictingFactSignals?: string[];
  dimensionId?: string;
};

export type BusinessConcept = {
  conceptId: BusinessConceptId;
  companyId: CompanyId;
  label: string;
  state: BusinessConceptState;
  confidence: number;
  /** 0–1 fraction of mapped fact keys observed. */
  coverage: number;
  supportingEvidenceIds: EvidenceId[];
  supportingFactKeys: string[];
  supportingFactIds: string[];
  supportingDocumentIds: string[];
  contradictingEvidenceIds: EvidenceId[];
  contradictingFactKeys: string[];
  reasoning: string;
  lastUpdated: string;
  snapshotId: string | null;
  /** Present fact values used for deterministic question evaluation (no hallucination). */
  factValues: Record<string, string | number | boolean | string[] | null>;
};

export type ConceptExplainabilityNode = {
  conceptId: BusinessConceptId;
  label: string;
  state: BusinessConceptState;
  confidence: number;
  evidenceIds: EvidenceId[];
  documentIds: string[];
  factKeys: string[];
};

export type DiligenceExplainabilityPath = {
  dimensionId: string;
  questionId: string;
  answerState: string;
  concepts: ConceptExplainabilityNode[];
  evidenceIds: EvidenceId[];
  documentIds: string[];
};
