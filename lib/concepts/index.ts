export {
  BUSINESS_CONCEPT_CATALOG,
  BUSINESS_CONCEPT_CATALOG_VERSION,
  canonicalFactKey,
  conceptsForFactKey,
  getConceptDefinition,
  isBusinessConceptId,
} from "./catalog";
export { BUSINESS_CONCEPT_IDS } from "@/lib/domain/business-concept";
export {
  aggregateBusinessConcepts,
  conceptsById,
  readConceptFact,
} from "./aggregate";
export {
  listCompanyBusinessConcepts,
  replaceCompanyBusinessConcepts,
} from "./persist";
export {
  buildAllExplainabilityPaths,
  buildExplainabilityPath,
} from "./explainability";
