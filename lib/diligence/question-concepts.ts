/**
 * Question → Business Concept evaluation map.
 * Questions evaluate concepts, never documents directly.
 */

import type { BusinessConceptId } from "@/lib/domain/business-concept";

export const QUESTION_CONCEPT_MAP: Record<string, BusinessConceptId[]> = {
  "q-fin-fund-operations": ["cash-management", "financial-performance"],
  "q-fin-revenue-growing": ["financial-performance", "sales-execution"],
  "q-fin-runway-sufficient": ["cash-management"],
  "q-fin-recurring-healthy": ["recurring-revenue", "revenue-quality"],
  "q-fin-concentration-financial": ["customer-concentration"],
  "q-gov-board-approvals": ["corporate-approvals", "board-oversight"],
  "q-gov-equity-issuances": ["equity-management", "corporate-approvals"],
  "q-gov-cadence": ["board-oversight", "governance"],
  "q-gov-cap-table": ["capital-structure"],
  "q-legal-ip-assignments": ["intellectual-property"],
  "q-legal-employment-agreements": ["employment"],
  "q-legal-customer-contracts": ["legal-structure", "sales-execution"],
  "q-cust-concentration": ["customer-concentration"],
  "q-cust-churn": ["revenue-quality"],
  "q-cust-nrr": ["revenue-quality"],
  "q-sec-policies": ["security-program", "compliance"],
  "q-sec-incident-response": ["security-program", "risk-management"],
  "q-sec-critical-controls": ["security-program"],
  "q-ops-kpi-monitoring": ["operational-excellence", "strategic-planning"],
  "q-ops-process-ownership": ["operational-excellence"],
  "q-ops-financial-controls": ["operational-excellence", "compliance"],
  "q-people-key-person": ["leadership", "people"],
  "q-people-attrition": ["people"],
  "q-people-org-clarity": ["people", "leadership"],
};

export function conceptsForQuestion(questionId: string): BusinessConceptId[] {
  return QUESTION_CONCEPT_MAP[questionId] ?? [];
}
